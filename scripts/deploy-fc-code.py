#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path
from urllib.parse import urlparse

from alibabacloud_fc20230330.client import Client as FcClient
from alibabacloud_fc20230330 import models as fc_models
from alibabacloud_tea_openapi import models as open_api_models
from alibabacloud_tea_util.models import RuntimeOptions


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    region = required_env("ALIYUN_FC_REGION")
    function_name = required_env("ALIYUN_FC_FUNCTION_NAME")
    access_key_id = required_env("ALIYUN_FC_ACCESS_KEY_ID")
    access_key_secret = required_env("ALIYUN_FC_ACCESS_KEY_SECRET")
    oss_bucket_name = required_env("ALIYUN_FC_CODE_OSS_BUCKET")
    oss_object_name = required_env("ALIYUN_FC_CODE_OSS_OBJECT")

    expected_runtime = os.environ.get("ALIYUN_FC_EXPECTED_RUNTIME", "custom.debian10")
    expected_handler = os.environ.get("ALIYUN_FC_EXPECTED_HANDLER", "").strip()

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        connect_timeout=10000,
        read_timeout=120000,
    )
    config.endpoint = f"fcv3.{region}.aliyuncs.com"
    client = FcClient(config)

    print(
        f"Deploying FC function: {function_name} ({region}) "
        f"from oss://{oss_bucket_name}/{oss_object_name}; "
        "public-publishing settings are merged when enabled; other settings are preserved"
    )

    public_settings = None
    if os.environ.get("CONFIGURE_PUBLIC_PUBLISHING") == "true":
        target = urlparse(required_env("PUBLISHING_WEBSITE_OSS_TARGET"))
        if target.scheme != "oss" or not target.netloc:
            raise RuntimeError("Invalid public website OSS target")
        current = client.get_function(function_name, fc_models.GetFunctionRequest()).body
        existing_env = dict(current.environment_variables or {})
        public_settings = {
            "PUBLISHING_PUBLIC_BUCKET": target.netloc,
            "PUBLISHING_PUBLIC_REGION": required_env("PUBLISHING_WEBSITE_OSS_REGION"),
            "PUBLISHING_PUBLIC_PREFIX": "/".join(filter(None, [target.path.strip("/"), "published"])),
            "PUBLISHING_PUBLIC_ORIGIN": "https://yanxiao.me",
            "PUBLISHING_PUBLIC_ACCESS_KEY_ID": required_env("PUBLISHING_WEBSITE_ACCESS_KEY_ID"),
            "PUBLISHING_PUBLIC_ACCESS_KEY_SECRET": required_env("PUBLISHING_WEBSITE_ACCESS_KEY_SECRET"),
        }
        migration = {k: v for k, v in existing_env.items() if k.startswith("OSS_CONTENT_") or k == "PRIVATE_RESOURCE_ROOT"}
        migration.update(public_settings)
        migration["ALIBABA_CLOUD_ACCESS_KEY_ID"] = required_env("ALIBABA_CLOUD_ACCESS_KEY_ID")
        migration["ALIBABA_CLOUD_ACCESS_KEY_SECRET"] = required_env("ALIBABA_CLOUD_ACCESS_KEY_SECRET")
        destination = Path(required_env("PUBLIC_MIGRATION_ENV_FILE"))
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump(migration, output)
        existing_env.update(public_settings)

    update_input = fc_models.UpdateFunctionInput(
        code=fc_models.InputCodeLocation(
            oss_bucket_name=oss_bucket_name,
            oss_object_name=oss_object_name,
        )
    )
    if public_settings is not None:
        update_input.environment_variables = existing_env
    request = fc_models.UpdateFunctionRequest(body=update_input)
    runtime = RuntimeOptions(
        connect_timeout=10000,
        read_timeout=120000,
    )
    response = client.update_function_with_options(
        function_name,
        request,
        {},
        runtime,
    ).body

    deployed_runtime = getattr(response, "runtime", None)
    deployed_handler = getattr(response, "handler", None)
    code_size = getattr(response, "code_size", None)
    last_modified = getattr(response, "last_modified_time", None)

    if deployed_runtime != expected_runtime or (
        expected_handler and deployed_handler != expected_handler
    ):
        raise RuntimeError(
            "Function code was updated, but the returned configuration does not match "
            f"runtime={expected_runtime!r}"
            + (f", handler={expected_handler!r}" if expected_handler else "")
            + "; "
            f"actual runtime={deployed_runtime!r}, handler={deployed_handler!r}"
        )

    print(
        f"FC code deployment succeeded: function={function_name}, "
        f"runtime={deployed_runtime}, handler={deployed_handler}, "
        f"codeSize={code_size}, lastModifiedTime={last_modified}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FC deployment failed: {exc}", file=sys.stderr)
        raise
