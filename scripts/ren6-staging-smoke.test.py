"""Offline safety regression checks; no network requests or test payments."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ren6_smoke", Path(__file__).with_name("ren6-staging-smoke.py"))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class StagingSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config_path = Path(self.temp.name) / "fixture.json"
        self.evidence_path = Path(self.temp.name) / "evidence.json"
        self.config = {
            "convexUrl": smoke.CONVEX,
            "webUrl": smoke.WEB,
            "renterId": "user_renter",
            "hostId": "user_host",
            "renterSessionId": "sess_renter",
            "hostSessionId": "sess_host",
            "vehicleId": "fixture",
        }

    def runner(self):
        self.config_path.write_text(json.dumps(self.config))
        return smoke.Runner(self.config_path, self.evidence_path)

    def test_production_url_is_rejected_before_any_service_request(self):
        self.config["convexUrl"] = "https://hidden-greyhound-476.convex.cloud"
        with patch.object(smoke, "request") as network:
            with self.assertRaisesRegex(smoke.SmokeError, "allowlisted dev"):
                self.runner()
            network.assert_not_called()

    def test_production_web_url_is_rejected_before_any_service_request(self):
        self.config["webUrl"] = "https://www.renegaderace.com"
        with patch.object(smoke, "request") as network:
            with self.assertRaisesRegex(smoke.SmokeError, "allowlisted staging"):
                self.runner()
            network.assert_not_called()

    def test_live_keys_are_rejected_before_any_service_request(self):
        for key in ("CLERK_SECRET_KEY", "STRIPE_SECRET_KEY"):
            env = {"CLERK_SECRET_KEY": "sk_test_fake", "STRIPE_SECRET_KEY": "sk_test_fake", key: "sk_live_fake"}
            with self.subTest(key=key), patch.dict(smoke.os.environ, env), patch.object(smoke, "request") as network:
                with self.assertRaisesRegex(smoke.SmokeError, "must be a test key"):
                    self.runner()
                network.assert_not_called()

    def test_same_user_cannot_stand_in_for_both_roles(self):
        self.config["hostId"] = self.config["renterId"]
        with patch.dict(smoke.os.environ, {"CLERK_SECRET_KEY": "sk_test_fake", "STRIPE_SECRET_KEY": "sk_test_fake"}), patch.object(smoke, "request") as network:
            with self.assertRaisesRegex(smoke.SmokeError, "separate renter"):
                self.runner()
            network.assert_not_called()

    def test_unmarked_customer_is_not_used_as_fixture(self):
        with patch.dict(smoke.os.environ, {"CLERK_SECRET_KEY": "sk_test_fake", "STRIPE_SECRET_KEY": "sk_test_fake"}), patch.object(smoke.Runner, "clerk", return_value={"private_metadata": {}}), patch.object(smoke.Runner, "convex") as convex:
            with self.assertRaisesRegex(smoke.SmokeError, "synthetic REN-6"):
                self.runner()
            convex.assert_not_called()

    def test_other_users_session_is_rejected_before_convex_call(self):
        responses = [{"private_metadata": {"ren6Smoke": True}}, {"user_id": "user_unrelated", "status": "active"}]
        with patch.dict(smoke.os.environ, {"CLERK_SECRET_KEY": "sk_test_fake", "STRIPE_SECRET_KEY": "sk_test_fake"}), patch.object(smoke.Runner, "clerk", side_effect=responses), patch.object(smoke.Runner, "convex") as convex:
            with self.assertRaisesRegex(smoke.SmokeError, "belong to its fixture"):
                self.runner()
            convex.assert_not_called()

    def test_cross_origin_redirect_does_not_forward_auth(self):
        handler = smoke.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, None, {}, "https://example.com"))


if __name__ == "__main__":
    unittest.main()
