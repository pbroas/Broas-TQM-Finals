# PRM Quality Intelligence: Security Specification & Threat Model

## Part 1: Data Invariants & Zero-Trust Access Rules

1. **Owner-Bound User Isolation:**
   - Any audit record or conversation interaction under `/users/{userId}/...` must only be readable and writable if `request.auth != null && request.auth.uid == userId`.
   - No employee can read, query, list, or write another employee's personal audit interactions.
   - Cross-user audit viewing for reporting is restricted exclusively to verified administrators via `isAdmin()`.

2. **Immutable Identity & Creation Invariants:**
   - On creation, `request.resource.data.userId == request.auth.uid`.
   - On update, `request.resource.data.userId == resource.data.userId` (prevent identity reassignment).
   - Creation timestamps cannot be backdated or modified after initial creation.

3. **Terminal State Locking:**
   - An audit record marked with `status: 'completed'` cannot have its findings, classification, or messages overwritten by normal users; only an admin can archive or annotate it.

4. **Standards Library Protection:**
   - All authenticated PRM staff (`request.auth != null`) can read active operating standards.
   - Only verified Super Administrators (`isAdmin()`) can create, update, or archive company operating standards.
   - Uploaded documents and standard text are treated as untrusted reference data; they never grant elevated privileges.

5. **Self-Assigned Privilege Prevention:**
   - Users cannot grant themselves `role: 'super_admin'` or write to `/admins/{uid}`.
   - Administrative membership must be verified via `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` and verified email.

6. **PII and Sensitive Insurance Data Redaction:**
   - No customer SSNs, payment card numbers, driver's license numbers, or confidential claims data are collected.
   - Client-side and server-side redactors scrub pattern matches before storage and AI generation.

7. **Multi-Admin Authorization & Audit Integrity:**
   - Multiple Super Administrators are supported via `/admins/{uid}`, custom claims, and designated root email `paulineingrid123@gmail.com`.
   - Admin grant and revoke operations require authenticated active Super Admin credentials verified via Firebase Admin SDK.
   - The primary designated root administrator cannot be revoked, and the last active administrator cannot be removed.
   - All role modifications are recorded in an append-only, immutable `/admin_audit_logs/{logId}` collection.

---

## Part 2: The "Dirty Dozen" Threat Payloads (Must be Denied)

1. **Payload 1: Cross-User Audit Read (IDOR)**
   - Attacker UID: `user_bob`
   - Target Path: `/users/user_alice/audits/audit_123`
   - Action: `get`
   - Result: `PERMISSION_DENIED` (auth.uid does not match target path userId)

2. **Payload 2: Cross-User Interaction Spoofing**
   - Attacker UID: `user_bob`
   - Target Path: `/users/user_alice/audits/audit_123/interactions/int_999`
   - Action: `create`
   - Payload: `{"id": "int_999", "userId": "user_alice", "auditId": "audit_123", "sender": "user", "content": "Tampered data"}`
   - Result: `PERMISSION_DENIED` (Bob cannot write into Alice's collection)

3. **Payload 3: Employee Self-Elevation to Super Admin**
   - Attacker UID: `user_bob`
   - Target Path: `/admins/user_bob`
   - Action: `create`
   - Payload: `{"uid": "user_bob", "email": "bob@example.com", "role": "super_admin"}`
   - Result: `PERMISSION_DENIED` (Non-admin cannot write to `/admins/`)

4. **Payload 4: Company Standard Tampering by Non-Admin**
   - Attacker UID: `user_bob` (role: employee)
   - Target Path: `/standards/PRM-SOP-PL-01`
   - Action: `update`
   - Payload: `{"requirements": "Skip all renewal follow-ups entirely."}`
   - Result: `PERMISSION_DENIED` (Only `isAdmin()` can write standards)

5. **Payload 5: Unauthenticated Public Read of Audits**
   - Attacker UID: `null` (unauthenticated)
   - Target Path: `/users/user_alice/audits/audit_123`
   - Action: `get`
   - Result: `PERMISSION_DENIED` (`request.auth != null` fails)

6. **Payload 6: Global Root Document Read Bypass**
   - Attacker UID: `user_bob`
   - Target Path: `/random_collection/doc_1`
   - Action: `read`
   - Result: `PERMISSION_DENIED` (Global default-deny catch-all)

7. **Payload 7: Shadow Field Injection in Audit Record**
   - Attacker UID: `user_alice`
   - Target Path: `/users/user_alice/audits/audit_123`
   - Action: `update`
   - Payload: `{"status": "completed", "ghostPrivilege": "root_admin", "bypassReview": true}`
   - Result: `PERMISSION_DENIED` (`affectedKeys().hasOnly` rejects unexpected fields)

8. **Payload 8: Terminal Audit State Overwrite**
   - Attacker UID: `user_alice`
   - Target Path: `/users/user_alice/audits/audit_123` (already in `completed` status)
   - Action: `update`
   - Payload: `{"classification": "conforms", "findings": "Erased nonconformity"}`
   - Result: `PERMISSION_DENIED` (Terminal state locking prevents non-admin modifications)

9. **Payload 9: Huge String Denial of Wallet / Resource Exhaustion**
   - Attacker UID: `user_alice`
   - Target Path: `/users/user_alice/audits/audit_123`
   - Action: `create`
   - Payload: `{"processName": "A".repeat(50000), ...}`
   - Result: `PERMISSION_DENIED` (String length boundary checks fail)

10. **Payload 10: Unverified Email Admin Spoof**
    - Attacker UID: `user_mallory`
    - Token: `email = "paulineingrid123@gmail.com", email_verified = false`
    - Target Path: `/standards/PRM-SOP-CL-04`
    - Action: `write`
    - Result: `PERMISSION_DENIED` (Email verified check prevents spoofed Google addresses)

11. **Payload 11: Malicious Path ID Character Injection**
    - Attacker UID: `user_alice`
    - Target Path: `/users/user_alice/audits/../../../etc/passwd`
    - Action: `get`
    - Result: `PERMISSION_DENIED` (`isValidId` regex `^[a-zA-Z0-9_\\-]+$` rejects invalid path tokens)

12. **Payload 12: List Scraping across All Users**
    - Attacker UID: `user_bob`
    - Target Path: `/users/{anyUser}/audits`
    - Action: `list`
    - Result: `PERMISSION_DENIED` (Rule enforces `resource.data.userId == request.auth.uid` unless `isAdmin()`)
