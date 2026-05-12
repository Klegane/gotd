## ADDED Requirements

### Requirement: Session invitations
The system SHALL allow session creators or admins to invite registered users to voting sessions.

#### Scenario: Creator invites user
- **WHEN** a session creator or admin invites a registered user to a session
- **THEN** the system creates or updates a participant record for that user and session

#### Scenario: Unauthorized user invites user
- **WHEN** a user who is not the session creator and not an admin attempts to invite users
- **THEN** the system rejects the request

#### Scenario: Duplicate invitation
- **WHEN** an invited user is invited to the same session again
- **THEN** the system keeps one participant record for that user and session

### Requirement: Invitation response
The system SHALL allow invited users to record their participation response.

#### Scenario: User accepts invitation
- **WHEN** an invited user accepts a session invitation
- **THEN** the system marks the participant record as accepted

#### Scenario: User declines invitation
- **WHEN** an invited user declines a session invitation
- **THEN** the system marks the participant record as declined and excludes that user from veto penalty fallback snapshots

#### Scenario: User changes response
- **WHEN** an invited user changes their participation response before the session is closed
- **THEN** the system updates the participant record with the new response

### Requirement: Attendance tracking
The system SHALL allow session creators or admins to mark who attended a session.

#### Scenario: Creator marks attendee
- **WHEN** a session creator or admin marks an invited user as attended
- **THEN** the system records that attendance for profile history and veto participant context

#### Scenario: Creator marks absence
- **WHEN** a session creator or admin marks an invited user as absent
- **THEN** the system records that absence and excludes the user from past played sessions

### Requirement: Invitation-aware session views
The system SHALL include invitation and participant information in session and profile views.

#### Scenario: Session detail includes participants
- **WHEN** an authenticated user opens a session they can view
- **THEN** the system includes participant names, invitation statuses, and attendance status when available

#### Scenario: Profile filters declined invitations
- **WHEN** an authenticated user opens their profile
- **THEN** declined future invitations are not shown as upcoming invited sessions
