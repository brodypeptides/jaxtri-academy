# Jaxtri Bank Transfer Fields

Adds dedicated bank transfer fields to `my-affiliate.html`:

- Account holder name
- Bank name
- Account type
- Routing #
- Account #

The owner payout queue now shows the affiliate note/details with line breaks so bank transfer details are readable.

## Files changed

```text
my-affiliate.html
owner-payouts.html
functions/api/payout-requests.js
```

## D1

No new migration required.

## Important security note

This patch stores bank transfer details in the payout profile/request notes in D1 so the owner can manually process payout. That is useful for manual payouts, but account and routing numbers are sensitive. For a later hardening sprint, add encryption-at-rest for bank fields and owner-only reveal controls.

## Commit message

```text
bank transfer payout fields
```
