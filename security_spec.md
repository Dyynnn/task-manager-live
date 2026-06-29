# Security Specification for Firestore Rules

This document outlines the security architecture, invariants, and threat-vector analysis for our Task Management application.

## 1. Data Invariants

1. **User Ownership**: Every project and task must be strictly associated with the authenticated user (`ownerId == request.auth.uid`). No user can create, read, update, or delete another user's projects or tasks.
2. **Project-Task Cohesion**: A task cannot be created without a valid `projectId`. The task's `ownerId` must match the `ownerId` of the parent project.
3. **Immutability of Key Identifiers**: Once created, the `ownerId` and `createdAt` fields on both `projects` and `tasks` are immutable and cannot be updated. The `projectId` on a task is also immutable.
4. **Strict Enumerations**:
   - Task `status` must be exactly `"pending"` or `"completed"`.
   - Task `priority` must be exactly `"low"`, `"medium"`, or `"high"`.
5. **Temporal Integrity**: Creation and update timestamps (`createdAt`, `updatedAt`) must rely strictly on `request.time` (server timestamp). Client-defined times are strictly rejected.
6. **Bounds Enforcements**:
   - Project name: string, 1 to 100 characters.
   - Task title: string, 1 to 200 characters.
   - Document IDs: must be valid alphanumeric/hyphen/underscore strings, max 128 characters.

---

## 2. The "Dirty Dozen" Payloads (Threat Vectors)

Here are the 12 hostile payloads designed to probe or bypass database constraints, which our security rules must strictly block.

### Payload 1: Identity Spoofing - Impersonating another user's ID on project creation
*   **Target Path**: `/projects/p123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "name": "Hostile List",
      "color": "bg-red-500",
      "ownerId": "victim_uid_999",
      "createdAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (ownerId must match actual authenticated user's UID).

### Payload 2: Ownership Theft - Attempting to change project owner after creation
*   **Target Path**: `/projects/p123`
*   **Operation**: `UPDATE`
*   **Hostile Payload**:
    ```json
    {
      "name": "Stolen List",
      "color": "bg-red-500",
      "ownerId": "attacker_uid_111",
      "createdAt": "existing().createdAt"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (ownerId is immutable).

### Payload 3: Orphaned Tasks - Creating a task for another user's project
*   **Target Path**: `/tasks/t123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "projectId": "victim_project_abc",
      "title": "Unwanted Task",
      "status": "pending",
      "priority": "high",
      "ownerId": "attacker_uid_111",
      "createdAt": "request.time",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (referenced project must exist and be owned by the caller).

### Payload 4: Identity Injection - Creating a task with a spoofed ownerId
*   **Target Path**: `/tasks/t123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "projectId": "attacker_project_xyz",
      "title": "Spoofed Task",
      "status": "pending",
      "priority": "high",
      "ownerId": "victim_uid_999",
      "createdAt": "request.time",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (task ownerId must match the authenticated user).

### Payload 5: State Corruption - Injecting invalid task status
*   **Target Path**: `/tasks/t123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "projectId": "my_project_123",
      "title": "Corrupt Task",
      "status": "malicious_status_abc",
      "priority": "high",
      "ownerId": "my_uid_555",
      "createdAt": "request.time",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (status must be 'pending' or 'completed').

### Payload 6: Denial of Wallet - Resource exhaustion via massive project name
*   **Target Path**: `/projects/p123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "name": "A_VERY_LONG_STRING_REPEATED_TEN_THOUSAND_TIMES_...",
      "color": "bg-blue-500",
      "ownerId": "my_uid_555",
      "createdAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (string size boundaries exceeded).

### Payload 7: Project Hijacking - Attempting to move a task to a different project
*   **Target Path**: `/tasks/t123`
*   **Operation**: `UPDATE`
*   **Hostile Payload**:
    ```json
    {
      "projectId": "different_project_id",
      "title": "Hijacked Task",
      "status": "pending",
      "priority": "high",
      "ownerId": "my_uid_555",
      "createdAt": "existing().createdAt",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (projectId is immutable).

### Payload 8: Clock Manipulation - Faking high/low timestamps
*   **Target Path**: `/tasks/t123`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "projectId": "my_project_123",
      "title": "Backdated Task",
      "status": "pending",
      "priority": "high",
      "ownerId": "my_uid_555",
      "createdAt": "timestamp('2000-01-01T00:00:00Z')",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (createdAt must match request.time exactly).

### Payload 9: Shadow Field Injection - Adding unauthorized properties during updates
*   **Target Path**: `/tasks/t123`
*   **Operation**: `UPDATE`
*   **Hostile Payload**:
    ```json
    {
      "title": "Updated Task",
      "status": "completed",
      "priority": "high",
      "unauthorized_shadow_field": "dangerous_payload",
      "updatedAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (affectedKeys must strictly match the permitted fields of the current action).

### Payload 10: ID Poisoning - Creating a project with malicious document ID characters/lengths
*   **Target Path**: `/projects/PROJECT_ID_WITH_SPECIAL_CHAR_$&%#_OR_VERY_LONG_ID`
*   **Operation**: `CREATE`
*   **Hostile Payload**:
    ```json
    {
      "name": "Standard List",
      "color": "bg-blue-500",
      "ownerId": "my_uid_555",
      "createdAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (document path variable must match clean regex and size checks).

### Payload 11: Privilege Escalation - Bypassing Authentication altogether
*   **Target Path**: `/projects/p123`
*   **Operation**: `CREATE` (Unauthenticated)
*   **Hostile Payload**:
    ```json
    {
      "name": "Anonymous List",
      "color": "bg-gray-500",
      "ownerId": "some_arbitrary_id",
      "createdAt": "request.time"
    }
    ```
*   **Expected Result**: `PERMISSION_DENIED` (request.auth cannot be null).

### Payload 12: List Query Leakage - Querying all documents in database
*   **Target Path**: `/tasks`
*   **Operation**: `LIST` (with no owner filter)
*   **Hostile Query**: `db.collection('tasks').get()`
*   **Expected Result**: `PERMISSION_DENIED` (list rule enforces checks against resource.data.ownerId).

---

## 3. Test Cases Verification Strategy

The security constraints defined above are tested using client validations, test scripts, and Firestore security rules. The final `firestore.rules` must verify:
- `request.auth != null` is evaluated first.
- Strict schema boundaries (`isValidProject` and `isValidTask`) are run on every write.
- Path parameter validations block poison IDs.
- Read operations are limited to the resource owner.
