#!/usr/bin/env python3
"""Phased REN-6 smoke test. Never accepts a production deployment or live Stripe key."""

import argparse
import base64
import datetime
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CONVEX = "https://earnest-panther-585.convex.cloud"
SITE = "https://earnest-panther-585.convex.site"
WEB = "https://renegade-web-env-staging-nineonenine.vercel.app"
ISSUER = "https://sure-rattler-22.clerk.accounts.dev"


class SmokeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SmokeError(message)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward credentials or signed payloads to another destination.
        return None


def request(url, method="GET", body=None, headers=None, form=False, allowed_errors=()):
    headers = dict(headers or {})
    headers["User-Agent"] = "Renegade-Staging-Verification/1.0"
    if body is not None:
        if isinstance(body, bytes):
            data = body
        elif form:
            data = urllib.parse.urlencode(body).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body, separators=(",", ":")).encode()
            headers["Content-Type"] = "application/json"
    else:
        data = None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=30) as response:
            raw = response.read()
            try:
                result = json.loads(raw) if raw else None
            except ValueError:
                result = raw.decode("utf-8", errors="replace")
            return response.status, result
    except urllib.error.HTTPError as error:
        if error.code in allowed_errors:
            return error.code, json.loads(error.read())
        # Provider error bodies can contain credentials, client secrets or PII.
        raise SmokeError(f"{urllib.parse.urlparse(url).hostname} returned HTTP {error.code}") from None
    except (urllib.error.URLError, TimeoutError):
        raise SmokeError(f"Network request failed: {urllib.parse.urlparse(url).hostname}") from None


class Runner:
    def __init__(self, config_path, evidence_path):
        self.config_path = Path(config_path)
        self.config = json.loads(self.config_path.read_text())
        self.evidence_path = Path(evidence_path)
        self.evidence = json.loads(self.evidence_path.read_text()) if self.evidence_path.exists() else []
        require(self.config.get("convexUrl") == CONVEX, "Only the allowlisted dev deployment is supported")
        require(self.config.get("webUrl") == WEB, "Only the allowlisted staging web app is supported")
        self.clerk_key = os.environ.get("CLERK_SECRET_KEY", "")
        self.stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
        require(self.clerk_key.startswith("sk_test_"), "CLERK_SECRET_KEY must be a test key")
        require(self.stripe_key.startswith("sk_test_"), "STRIPE_SECRET_KEY must be a test key")
        require(self.config["renterId"] != self.config["hostId"], "Use separate renter and host accounts")
        self.tokens = {}
        for role in ("renter", "host"):
            user_id = self.config[role + "Id"]
            require(re.fullmatch(r"user_[A-Za-z0-9]+", user_id), "Invalid Clerk fixture user ID")
            user = self.clerk("/users/" + user_id)
            require(user.get("private_metadata", {}).get("ren6Smoke") is True,
                    f"{role} must be an explicitly marked synthetic REN-6 Clerk fixture")
            session_id = self.config[role + "SessionId"]
            require(re.fullmatch(r"sess_[A-Za-z0-9]+", session_id), "Invalid Clerk fixture session ID")
            session = self.clerk("/sessions/" + session_id)
            require(session.get("user_id") == user_id and session.get("status") == "active",
                    f"{role} session must be active and belong to its fixture user")
        vehicle = self.convex("renter", "query", "vehicles:getById", {"id": self.config["vehicleId"]})
        require(vehicle.get("ownerId") == self.config["hostId"], "Vehicle must belong to the synthetic host")
        require("REN-6" in vehicle.get("description", ""), "Vehicle description must mark it as REN-6 synthetic data")
        require(vehicle.get("isApproved") is True and vehicle.get("isActive") is True,
                "Synthetic vehicle must be approved and active")
        # Keep test charges small even though Stripe test mode cannot move real funds.
        require(100 <= vehicle["dailyRate"] <= 10000, "Fixture daily rate must be $1–$100 in cents")
        self.vehicle = vehicle
        if self.config.get("reservationId"):
            reservation = self.reservation()
            self.assert_participants(reservation)

    def clerk(self, path, method="GET", body=None):
        return request("https://api.clerk.com/v1" + path, method, body,
                       {"Authorization": "Bearer " + self.clerk_key})[1]

    def token(self, role):
        cached = self.tokens.get(role)
        if cached and cached[1] > time.time() + 15:
            return cached[0]
        token = self.clerk("/sessions/" + self.config[role + "SessionId"] + "/tokens/convex", "POST", {})["jwt"]
        segment = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
        audience = claims.get("aud")
        require(audience == "convex" or (isinstance(audience, list) and "convex" in audience),
                "Clerk JWT template must have audience convex")
        require(claims.get("iss") == ISSUER and claims.get("sub") == self.config[role + "Id"],
                "Clerk JWT issuer/subject does not match the staging fixture")
        require(claims.get("exp", 0) > time.time(), "Clerk returned an expired JWT")
        self.tokens[role] = (token, claims["exp"])
        return token

    def convex(self, role, kind, function, args):
        result = request(CONVEX + "/api/" + kind, "POST",
                         {"path": function, "args": args, "format": "json"},
                         {"Authorization": "Bearer " + self.token(role)})[1]
        require(result.get("status") == "success", f"Convex {function} failed (details omitted to protect credentials)")
        return result.get("value")

    def stripe(self, path, method="GET", body=None, allowed_errors=()):
        status, result = request("https://api.stripe.com/v1" + path, method, body,
                                 {"Authorization": "Bearer " + self.stripe_key},
                                 form=True, allowed_errors=allowed_errors)
        if isinstance(result, dict) and "livemode" in result:
            require(result["livemode"] is False, "Refusing a live Stripe object")
        return status, result

    def save(self):
        # Config contains session identifiers, never JWTs, API keys, or client secrets.
        self.config_path.write_text(json.dumps(self.config, indent=2) + "\n")
        self.config_path.chmod(0o600)
        self.evidence_path.write_text(json.dumps(self.evidence, indent=2) + "\n")
        self.evidence_path.chmod(0o600)

    def record(self, phase, **fields):
        item = {"phase": phase, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}
        self.evidence.append(item)
        self.save()
        print(json.dumps(item))

    def assert_participants(self, reservation):
        require(reservation and reservation["renterId"] == self.config["renterId"]
                and reservation["ownerId"] == self.config["hostId"]
                and reservation["vehicleId"] == self.config["vehicleId"], "Reservation does not belong to these fixtures")

    def reservation(self, role="renter"):
        return self.convex(role, "query", "reservations:getById", {"id": self.config["reservationId"]})

    def payments(self):
        rows = self.convex("renter", "query", "stripe:getUserPayments", {"userId": self.config["renterId"]})
        return [row for row in rows if row["reservationId"] == self.config["reservationId"]]

    def payment(self):
        rows = self.payments()
        require(len(rows) == 1, "Expected exactly one financial record for the reservation")
        require(rows[0]["renterId"] == self.config["renterId"] and rows[0]["ownerId"] == self.config["hostId"],
                "Unexpected payment participants")
        return rows[0]

    def success_notifications(self):
        rows = self.convex("renter", "query", "notifications:getUserNotifications", {
            "userId": self.config["renterId"], "limit": 100,
        })
        return [row for row in rows if row.get("type") == "payment_success"
                and row.get("metadata", {}).get("reservationId") == self.config["reservationId"]]

    def wait_state(self, status, payment_status, financial_status=None, timeout=90):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            reservation = self.reservation()
            if reservation.get("status") == status and reservation.get("paymentStatus") == payment_status:
                if financial_status is None or self.payment().get("status") == financial_status:
                    return reservation
            time.sleep(2)
        raise SmokeError("Timed out waiting for persisted state; check staging webhook delivery before proceeding")

    def request_booking(self):
        require(not self.config.get("reservationId"), "A reservation already exists; use a new config for a new run")
        start = datetime.date.fromisoformat(self.config["startDate"])
        require(start > datetime.date.today(), "Use a future rental date")
        require(type(self.config["durationDays"]) is int and 1 <= self.config["durationDays"] <= 3,
                "Rental duration must be 1–3 inclusive days")
        reservation_id = self.convex("renter", "mutation", "reservations:create", {
            "vehicleId": self.config["vehicleId"], "startDate": start.isoformat(),
            "durationDays": self.config["durationDays"], "renterMessage": "REN-6 synthetic staging smoke booking",
        })
        self.config["reservationId"] = reservation_id
        self.save()  # Retain cleanup reference even if the following assertions fail.
        reservation = self.reservation()
        self.assert_participants(reservation)
        require(reservation["status"] == "pending", "New request did not persist as pending")
        require(reservation["totalDays"] == self.config["durationDays"], "Persisted duration differs from request")
        require(reservation["totalAmount"] == self.vehicle["dailyRate"] * self.config["durationDays"], "Incorrect rental amount")
        self.record("requested", reservationId=reservation_id, totalDays=reservation["totalDays"], amountCents=reservation["totalAmount"])

    def approve(self):
        self.convex("host", "mutation", "reservations:approve", {"reservationId": self.config["reservationId"]})
        require(self.reservation("host")["status"] == "approved", "Host approval did not persist")
        self.record("approved", status="approved")

    def create_intent(self):
        reservation = self.reservation()
        result = self.convex("renter", "action", "stripe:createPaymentIntent", {
            "reservationId": self.config["reservationId"], "amount": reservation["totalAmount"],
        })
        payment = self.payment()
        require(payment["_id"] == result["paymentId"], "Checkout returned the wrong payment record")
        intent_id = payment["stripePaymentIntentId"]
        if self.config.get("intentId"):
            require(self.config["intentId"] == intent_id, "Retry created a different Stripe PaymentIntent")
        self.config["intentId"] = intent_id
        self.save()
        return intent_id

    def confirm(self, decline):
        require(self.reservation()["status"] == "approved", "Payment requires an approved reservation")
        intent_id = self.create_intent()
        _, intent = self.stripe("/payment_intents/" + intent_id)
        require(intent.get("metadata", {}).get("reservationId") == self.config["reservationId"], "Wrong Stripe intent metadata")
        require(intent["status"] == "requires_payment_method", "Intent is not awaiting a new payment method")
        status, result = self.stripe("/payment_intents/" + intent_id + "/confirm", "POST", {
            "payment_method": "pm_card_chargeDeclined" if decline else "pm_card_visa",
            "return_url": WEB + "/checkout/success?reservationId=" + self.config["reservationId"],
        }, allowed_errors=(402,) if decline else ())
        if decline:
            require(status == 402 and result.get("error", {}).get("code") == "card_declined", "Expected Stripe test decline")
            self.wait_state("approved", "failed", "failed")
            self.record("declined", reservationStatus="approved", paymentStatus="failed", paymentRows=1)
        else:
            require(result.get("status") == "succeeded", "Stripe test payment did not succeed")
            reservation = self.wait_state("confirmed", "paid", "succeeded")
            payment = self.payment()
            require(reservation.get("paymentId") == payment["_id"] and payment.get("stripeChargeId"), "Missing payment linkage/charge")
            for role, listing_role in (("renter", "renter"), ("host", "owner")):
                listing = self.convex(role, "query", "reservations:getByUser", {"userId": self.config[role + "Id"], "role": listing_role})
                matching = [row for row in listing if row["_id"] == self.config["reservationId"]]
                require(len(matching) == 1 and matching[0]["status"] == "confirmed", f"{role} reservation projection is not confirmed")
            self.record("paid", reservationStatus="confirmed", paymentStatus="paid", paymentRows=1,
                        amountCents=payment["amount"], chargeAmountCents=result["amount"], stripeIntentId=intent_id)

    def duplicate(self):
        require(self.reservation().get("paymentStatus") == "paid", "First wait for natural Stripe webhook delivery")
        signing_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        require(signing_secret.startswith("whsec_"), "STRIPE_WEBHOOK_SECRET is required for signed duplicate replay")
        _, events = self.stripe("/events?" + urllib.parse.urlencode({"type": "payment_intent.succeeded", "limit": 100}))
        matches = [event for event in events["data"] if event.get("data", {}).get("object", {}).get("id") == self.config["intentId"]]
        require(matches, "Real Stripe success event not found; do not fabricate an event")
        event = matches[0]
        require(event.get("livemode") is False and not event.get("account"), "Expected a platform test event")
        before = self.payment()
        deadline = time.monotonic() + 30
        while not self.success_notifications() and time.monotonic() < deadline:
            time.sleep(2)
        require(len(self.success_notifications()) == 1, "Expected exactly one success notification before duplicate")
        raw = json.dumps(event, separators=(",", ":")).encode()
        timestamp = str(int(time.time()))
        signature = hmac.new(signing_secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
        # The event came from Stripe; only its transport signature is regenerated.
        status, _ = request(SITE + "/stripe/webhook", "POST", raw,
                            {"Content-Type": "application/json", "Stripe-Signature": f"t={timestamp},v1={signature}"})
        require(status == 200, "Duplicate webhook was not acknowledged")
        time.sleep(3)
        self.wait_state("confirmed", "paid", "succeeded")
        after = self.payment()
        require(all(before.get(key) == after.get(key) for key in ("_id", "amount", "status", "stripeChargeId", "stripePaymentIntentId")),
                "Duplicate delivery changed financial state")
        require(len(self.success_notifications()) == 1, "Duplicate delivery created another success notification")
        self.config["successEventId"] = event["id"]
        self.record("duplicate", eventId=event["id"], paymentRows=1, successNotifications=1,
                    reservationStatus="confirmed", financialStateUnchanged=True)

    def cleanup(self):
        reservation = self.reservation("host")
        if reservation["status"] != "cancelled":
            self.convex("host", "mutation", "reservations:cancel", {
                "reservationId": self.config["reservationId"], "cancellationReason": "REN-6 synthetic test cleanup",
            })
        rows = self.payments()
        if rows and rows[0]["status"] in ("succeeded", "partially_refunded", "refunded"):
            self.wait_state("cancelled", "refunded", "refunded")
            _, intent = self.stripe("/payment_intents/" + rows[0]["stripePaymentIntentId"])
            charge_id = intent["latest_charge"]
            _, charge = self.stripe("/charges/" + charge_id)
            require(charge["refunded"] is True and charge["amount_refunded"] == charge["amount"], "Stripe refund is incomplete")
            self.record("cleanup", reservationStatus="cancelled", paymentStatus="refunded", fullTestRefund=True, financialRowsRetained=True)
        else:
            if rows and rows[0].get("stripePaymentIntentId"):
                _, intent = self.stripe("/payment_intents/" + rows[0]["stripePaymentIntentId"])
                if intent["status"] not in ("canceled", "succeeded"):
                    self.stripe("/payment_intents/" + intent["id"] + "/cancel", "POST", {})
            require(self.reservation()["status"] == "cancelled", "Cleanup did not cancel the booking")
            self.record("cleanup", reservationStatus="cancelled", financialRowsRetained=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("preflight", "request", "approve", "decline", "pay", "duplicate", "cleanup"))
    parser.add_argument("--config", required=True, help="Local fixture config JSON (never commit)")
    parser.add_argument("--evidence", required=True, help="Sanitized JSON results path outside the repository")
    args = parser.parse_args()
    runner = Runner(args.config, args.evidence)
    if args.phase == "preflight":
        runner.record("preflight", convexUrl=CONVEX, clerkIssuer=ISSUER, stripeMode="test", separateRoles=True)
    elif args.phase == "request":
        runner.request_booking()
    elif args.phase == "approve":
        runner.approve()
    elif args.phase in ("decline", "pay"):
        runner.confirm(decline=args.phase == "decline")
    elif args.phase == "duplicate":
        runner.duplicate()
    else:
        runner.cleanup()


if __name__ == "__main__":
    try:
        main()
    except (SmokeError, KeyError, ValueError) as error:
        # Never print provider payloads or bearer credentials on failure.
        message = str(error) if isinstance(error, SmokeError) else "Invalid fixture/config or unexpected provider response"
        print(json.dumps({"status": "failed", "message": message}), file=sys.stderr)
        sys.exit(1)
