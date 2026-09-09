#!/usr/bin/env python3
import os
import sys

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

    expected_runtime = os.environ.get("ALIYUN_FC_EXPECTED_RUNTIME", "nodejs20")
    expected_handler = os.environ.get("ALIYUN_FC_EXPECTED_HANDLER", "index.handler")

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        connect_timeout=10000,
        read_timeout=120000,
    )
    config.endpoint = f"fcv3.{region}.aliyuncs.com"
    client = FcClient(config)

    print(
        f"Deploying code only to FC function: {function_name} ({region}) "
        f"from oss://{oss_bucket_name}/{oss_object_name}; "
        "existing environment variables and function settings are omitted from the update request"
    )

    update_input = fc_models.UpdateFunctionInput(
        code=fc_models.InputCodeLocation(
            oss_bucket_name=oss_bucket_name,
            oss_object_name=oss_object_name,
        )
    )
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

    if deployed_runtime != expected_runtime or deployed_handler != expected_handler:
        raise RuntimeError(
            "Function code was updated, but the returned configuration does not match "
            f"runtime={expected_runtime!r}, handler={expected_handler!r}; "
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
