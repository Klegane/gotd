## ADDED Requirements

### Requirement: Persisted user notifications
The system SHALL store notifications for individual authenticated users.

#### Scenario: Notification is created
- **WHEN** a notification-triggering event occurs for a user
- **THEN** the system stores a notification with type, text, created time, unread state, and relevant navigation target when available

#### Scenario: User lists notifications
- **WHEN** an authenticated user requests notifications
- **THEN** the system returns only notifications addressed to that user

### Requirement: Notification read state
The system SHALL allow users to mark notifications as read.

#### Scenario: User marks one notification read
- **WHEN** an authenticated user marks one of their notifications as read
- **THEN** the system stores the read timestamp and removes it from the unread count

#### Scenario: User marks all notifications read
- **WHEN** an authenticated user marks all notifications as read
- **THEN** the system marks all of that user's unread notifications as read

#### Scenario: User cannot mark another user's notification
- **WHEN** an authenticated user attempts to mark another user's notification as read
- **THEN** the system rejects the request

### Requirement: Session activity notifications
The system SHALL notify affected users about relevant session activity.

#### Scenario: User is invited to session
- **WHEN** a user is invited to a session
- **THEN** the system creates a notification for the invited user

#### Scenario: Invited session changes
- **WHEN** a session is updated or cancelled
- **THEN** the system creates notifications for non-declined invited users

#### Scenario: Session receives message
- **WHEN** a user writes a message in a session
- **THEN** the system creates notifications for other non-declined invited or participating users

#### Scenario: Session is settled
- **WHEN** a session is settled or closed with a played game
- **THEN** the system creates notifications for non-declined invited or participating users

### Requirement: Point notifications
The system SHALL notify users about priority point gains and losses.

#### Scenario: Ledger entry created
- **WHEN** a priority point ledger entry is created for a user
- **THEN** the system creates a notification for that user describing the point change

### Requirement: Main screen notification access
The system SHALL provide notification access from the main screen.

#### Scenario: Main screen shows unread count
- **WHEN** an authenticated user has unread notifications
- **THEN** the main screen notification button shows the unread count

#### Scenario: User opens notification panel
- **WHEN** an authenticated user opens the main screen notification panel
- **THEN** the system shows recent notifications with read state and navigation targets
