import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("deploy_fc", Path(__file__).with_name("deploy-fc-code.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DeploymentTest(unittest.TestCase):
    def test_public_settings_preserve_existing_secrets_and_other_function_settings(self):
        updates = []

        class Client:
            def __init__(self, config):
                pass

            def get_function(self, name, request):
                return SimpleNamespace(body=SimpleNamespace(environment_variables={
                    "SESSION_CURRENT_KEY": "private-session-key", "OSS_CONTENT_BUCKET": "private-bucket",
                    "PRIVATE_RESOURCE_ROOT": "/private", "UNRELATED_SETTING": "preserved",
                }))

            def update_function_with_options(self, name, request, headers, runtime):
                updates.append(request.body)
                return SimpleNamespace(body=SimpleNamespace(runtime="custom.debian10", handler="", code_size=1, last_modified_time="now"))

        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / "migration.json"
            env = {
                "ALIYUN_FC_REGION": "cn-beijing", "ALIYUN_FC_FUNCTION_NAME": "test-function",
                "ALIYUN_FC_ACCESS_KEY_ID": "test-fc", "ALIYUN_FC_ACCESS_KEY_SECRET": "test-fc-secret",
                "ALIYUN_FC_CODE_OSS_BUCKET": "private-bucket", "ALIYUN_FC_CODE_OSS_OBJECT": "code.zip",
                "CONFIGURE_PUBLIC_PUBLISHING": "true", "PUBLISHING_WEBSITE_OSS_TARGET": "oss://website/site/",
                "PUBLISHING_WEBSITE_OSS_REGION": "cn-beijing", "PUBLISHING_WEBSITE_ACCESS_KEY_ID": "test-site",
                "PUBLISHING_WEBSITE_ACCESS_KEY_SECRET": "test-site-secret", "PUBLIC_MIGRATION_ENV_FILE": str(destination),
                "ALIBABA_CLOUD_ACCESS_KEY_ID": "test-source", "ALIBABA_CLOUD_ACCESS_KEY_SECRET": "test-source-secret",
            }
            output = io.StringIO()
            with patch.dict(os.environ, env, clear=True), patch.object(module, "FcClient", Client), contextlib.redirect_stdout(output):
                self.assertEqual(module.main(), 0)
            update = updates[0]
            self.assertEqual(update.environment_variables["SESSION_CURRENT_KEY"], "private-session-key")
            self.assertEqual(update.environment_variables["UNRELATED_SETTING"], "preserved")
            self.assertEqual(update.environment_variables["PUBLISHING_PUBLIC_PREFIX"], "site/published")
            self.assertIsNone(update.role)
            self.assertIsNone(update.timeout)
            migration = json.loads(destination.read_text())
            self.assertNotIn("SESSION_CURRENT_KEY", migration)
            self.assertNotIn("UNRELATED_SETTING", migration)
            self.assertEqual(migration["OSS_CONTENT_BUCKET"], "private-bucket")
            self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
            for secret in ["private-session-key", "test-site-secret", "test-source-secret"]:
                self.assertNotIn(secret, output.getvalue())


if __name__ == "__main__":
    unittest.main()
