#!/usr/bin/env python3
import base64
import os
import sys
from pathlib import Path

from alibabacloud_fc20230330.client import Client as FcClient
from alibabacloud_fc20230330 import models as fc_models
from alibabacloud_tea_openapi import models as open_api_models


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
    zip_path = Path(required_env("ALIYUN_FC_CODE_ZIP"))

    expected_runtime = os.environ.get("ALIYUN_FC_EXPECTED_RUNTIME", "nodejs20")
    expected_handler = os.environ.get("ALIYUN_FC_EXPECTED_HANDLER", "index.handler")

    if not zip_path.is_file():
        raise RuntimeError(f"Function package does not exist: {zip_path}")

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
    )
    config.endpoint = f"fcv3.{region}.aliyuncs.com"
    client = FcClient(config)

    current = client.get_function(function_name, fc_models.GetFunctionRequest()).body
    current_runtime = getattr(current, "runtime", None)
    current_handler = getattr(current, "handler", None)

    print(
        f"Target FC function: {function_name} ({region}), "
        f"runtime={current_runtime}, handler={current_handler}"
    )

    if current_runtime != expected_runtime:
        raise RuntimeError(
            f"Refusing deployment: runtime is {current_runtime!r}, expected {expected_runtime!r}"
        )
    if current_handler != expected_handler:
        raise RuntimeError(
            f"Refusing deployment: handler is {current_handler!r}, expected {expected_handler!r}"
        )

    zip_file = base64.b64encode(zip_path.read_bytes()).decode("ascii")
    update_input = fc_models.UpdateFunctionInput(
        code=fc_models.InputCodeLocation(zip_file=zip_file)
    )
    request = fc_models.UpdateFunctionRequest(body=update_input)
    response = client.update_function(function_name, request).body

    deployed_runtime = getattr(response, "runtime", None)
    deployed_handler = getattr(response, "handler", None)
    code_size = getattr(response, "code_size", None)
    last_modified = getattr(response, "last_modified_time", None)

    if deployed_runtime != expected_runtime or deployed_handler != expected_handler:
        raise RuntimeError("Function configuration changed unexpectedly after code deployment")

    print(
        f"FC code deployment succeeded: function={function_name}, "
        f"codeSize={code_size}, lastModifiedTime={last_modified}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FC deployment failed: {exc}", file=sys.stderr)
        raise
