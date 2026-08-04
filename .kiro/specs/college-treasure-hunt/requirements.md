# Requirements Document

## Introduction

A QR-code-based Treasure Hunt web application for college events at RJMMsVishwakamal Mahavidhayal. Students register, then navigate 5 sequential QR code stations placed around the college. Each station presents a puzzle or quiz with an access code to confirm completion and unlock the next stage. The application includes a professional Admin Panel for managing the event, participants, ban lists, questions, and scheduling. The entire application is mobile-first and responsive, as students use phones during the event.

---

## Glossary

- **Application**: The Treasure Hunt web application served to students and admins.
- **Student**: A registered college participant taking part in the treasure hunt event.
- **Admin**: An authenticated operator who manages the event via the Admin Panel.
- **Admin_Panel**: The password-protected administrative interface accessible 24/7.
- **Registration_System**: The module that collects student name and phone number and stores them in the database.
- **Database**: The persistent data store for participants, ban list, event configuration, and stage content.
- **QR_Code**: A machine-readable code placed physically at a station around the college.
- **QR_Scanner**: The built-in camera-based QR code reading component within the Application.
- **Stage**: One of the five sequential steps in the treasure hunt, each associated with a QR code page.
- **Stage_Page**: The web page unlocked upon scanning a QR code, containing a puzzle, a hint, and an access code field.
- **Access_Code**: A unique 6-alphanumeric-character code tied to each Stage that the Student must enter to confirm completion of that Stage; the Access_Code is set by the Admin and is separate from any puzzle answer.
- **Puzzle**: A challenge displayed on a Stage_Page that the Student must solve to determine the physical location of the next QR code; the puzzle does not need to be answered on-screen — the student solves it physically and then enters the Access_Code written at that location.
- **Difficulty_Level**: A label assigned to each Stage indicating the relative complexity of its Puzzle: Medium (Stage 1), Medium-Hard (Stage 2), Hard (Stage 3), Very Hard (Stage 4), Final Boss (Stage 5).
- **Word_Fragment**: A single word displayed on a Stage_Page for Stages 1–4 that the Student must remember and combine with fragments from other stages to form the Stage 5 final Access_Code.
- **Leaderboard**: A ranked list of participants who have completed all 5 stages, ordered by total completion time from event start to Stage 5 submission, displayed publicly on the Congratulations_Screen and in the Admin_Panel.
- **Hint**: A textual clue on a Stage_Page guiding the Student to the physical location of the next QR code.
- **Session**: The browser-based authenticated state that tracks a Student's progress through the hunt.
- **Ban_List**: An Admin-managed list of banned names and/or phone numbers that prevents registration.
- **Event_Window**: The admin-configured start and end date/time during which the student-facing event is accessible.
- **Congratulations_Screen**: The final screen displayed after a Student successfully completes all 5 stages.
- **Duplicate**: A registration attempt using a name or phone number already present in the Database.
- **Styled_QR**: A QR code rendered with visual styling including color/gradient patterns, a centered college logo overlay, and a faded college logo watermark background.
- **Registration_QR**: A dedicated styled QR code that encodes the registration page URL. Placed at the event entry point. Separate from the 5 Puzzle QRs.
- **Puzzle_QR**: One of the 5 styled QR codes placed at physical locations around the college, each encoding a unique stage URL. Scanning a Puzzle_QR inside the app unlocks the corresponding Stage_Page.
- **QR_Card**: The printed sheet for each Puzzle_QR (QR 1–5) that displays the styled QR image, the 6-character Access_Code printed below it, and — for QR 1–4 — the Word_Fragment printed below the Access_Code.
- **QR_Countdown_Page**: The page displayed when a QR code is scanned outside the Event_Window, showing a live server-driven countdown to the event start or an event-ended message.

---

## Requirements

### Requirement 1: College Branding

**User Story:** As a Student, I want to see the college name and logo on the Application, so that I know this event is officially associated with RJMMsVishwakamal Mahavidhayal.

#### Acceptance Criteria

1. THE Application SHALL display both the text "RJMMsVishwakamal Mahavidhayal" and the college logo image together in the header on all student-facing pages, where "student-facing pages" means every page a Student can access after opening the Application, including the registration page, all Stage_Pages, and the Congratulations_Screen.
2. THE Application SHALL source the college logo from the configured logo URL and render it alongside the college name text; IF the configured logo URL is empty or null, THEN THE Application SHALL omit the logo image slot entirely and display only the college name text.
3. IF the college logo image fails to load or fails to render for any reason after a fetch attempt, THEN THE Application SHALL omit the logo image slot and the college name text already present in the header SHALL serve as the sole branding indicator.

---

### Requirement 2: Student Registration

**User Story:** As a Student, I want to register with my name and phone number before participating, so that my participation is recorded and I can begin the hunt.

#### Acceptance Criteria

1. THE Registration_System SHALL present a registration form requiring exactly two fields: full name and phone number.
2. WHEN a Student submits the registration form with a valid name and a valid 10-digit phone number, THE Registration_System SHALL store the record in the Database and create an active Session for the Student; IF the Database write or Session creation fails, THEN THE Registration_System SHALL roll back any partial write and display a generic error message without creating a partial record.
3. IF a Student submits a name that already exists in the Database (using case-insensitive comparison), THEN THE Registration_System SHALL reject the registration and display the message "This name is already registered."
4. IF a Student submits a phone number that already exists in the Database, THEN THE Registration_System SHALL reject the registration and display the message "This phone number is already registered."
5. IF a Student submits a name that matches any entry in the Ban_List (using case-insensitive comparison), THEN THE Registration_System SHALL reject the registration and display the message "Registration is not allowed."
6. IF a Student submits a phone number that matches any entry in the Ban_List, THEN THE Registration_System SHALL reject the registration and display the message "Registration is not allowed."
7. WHEN registration is rejected for any reason, THE Registration_System SHALL NOT create a Session or store any partial data.
8. WHEN registration is accepted, THE Application SHALL redirect the Student to Stage 1 of the hunt.
9. THE Registration_System SHALL validate that the name field contains at least 2 non-whitespace characters and no more than 100 characters, and SHALL reject names consisting entirely of whitespace.
10. THE Registration_System SHALL validate that the phone number field contains exactly 10 numeric digits, excluding any formatting characters such as spaces, dashes, or parentheses.

---

### Requirement 3: Event Scheduling and Access Control

**User Story:** As an Admin, I want to configure event start and end times per edition, so that the student-facing event is only accessible during the scheduled window of the Active_Edition.

#### Acceptance Criteria

1. THE Admin_Panel SHALL allow the Admin to set and edit (update) an event start date/time and an event end date/time for the Active_Edition, where both values are specified in the server's configured timezone and the end date/time is at least 1 minute after the start date/time; the edit form SHALL be pre-populated with the currently saved start and end date/time values so the Admin can review and adjust them at any point before or during the event.
2. IF the Admin submits an event end date/time that is not after the event start date/time, THEN THE Admin_Panel SHALL reject the submission and display an error message indicating the end time must be later than the start time, without saving any changes.
3. WHILE the current server time is before the Active_Edition's start date/time, THE Application SHALL display a message indicating the event has not started to Students and SHALL NOT allow registration or access to any event stage.
4. WHILE the current server time is after the Active_Edition's end date/time, THE Application SHALL display a message indicating the event has ended to Students and SHALL NOT allow registration or access to any event stage.
5. WHILE the current server time is within the Active_Edition's Event_Window, THE Application SHALL allow Students to register and access event stages.
6. THE Admin_Panel SHALL remain accessible to the Admin regardless of the Event_Window status.
7. WHEN the Admin saves updated event start or end date/time, THE Application SHALL apply the new Event_Window within 1 second for all subsequent student requests.

---

### Requirement 4: QR Code Flow and Stage Navigation

**User Story:** As a Student, I want to scan a Registration QR to register and then find and scan 5 separate Puzzle QRs to progress through all stages, so that I can complete the treasure hunt.

#### Acceptance Criteria

1. THE Application SHALL generate 6 distinct QR codes in total: 1 Registration_QR and 5 Puzzle_QRs (one per stage), each encoding a unique URL and physically placed at different locations.

2. WHEN a Student scans the Registration_QR using any standard QR scanner app, THE Application SHALL direct the Student to the registration page; after successful registration the Student is prompted to find Puzzle QR 1 using the hint shown on the registration confirmation screen.

3. THE Application SHALL serve a unique URL for each of the 5 Puzzle_QR Stage_Pages, accessible only to Students with an active Session whose current stage progress equals the stage number of that Puzzle_QR.

4. WHEN a Student with an active Session scans Puzzle_QR 1 using an external QR scanner app (since Stage 1 is the first in-hunt scan), THE Application SHALL display the Stage_Page for Stage 1.

5. WHEN a Student with an active Session successfully submits the correct Access_Code for their current Stage and is redirected, THE Application SHALL display the QR_Scanner interface for the next Puzzle_QR (for Stages 1–4) so the Student can scan QR 2, 3, 4, or 5 in-app.

6. WHEN the QR_Scanner successfully reads a Puzzle_QR whose encoded value matches the expected value for the Student's current Stage, THE Application SHALL display the Stage_Page for that Stage.

7. IF the QR_Scanner reads a QR code whose encoded value does not match the expected value for the Student's current Stage, THEN THE Application SHALL display the error message "Wrong QR code. Please find the correct one." and SHALL NOT advance the Student's progress.

8. IF a Student attempts to access a Stage_Page URL for a stage number greater than their current progress level, THEN THE Application SHALL redirect the Student to their current stage and display the message "Please complete your current stage first."

9. IF a Student attempts to access a Stage_Page URL for a stage number less than their current progress level (already completed), THEN THE Application SHALL redirect the Student to their current stage and display the message "You have already completed this stage."

10. IF the QR_Scanner does not detect a valid QR code within 30 seconds of activation, THEN THE Application SHALL display a prompt asking the Student to try scanning again, without advancing or cancelling their progress.

---

### Requirement 5: Stage Page Content and Puzzle Definitions

**User Story:** As a Student, I want each stage page to show a progressively harder puzzle, a hint to the next location, and an access code field, so that I can physically solve the challenge and confirm my completion at each station.

#### Acceptance Criteria

1. THE Application SHALL assign a Difficulty_Level label to each Stage and display it prominently on the Stage_Page: Stage 1 = "Medium", Stage 2 = "Medium-Hard", Stage 3 = "Hard", Stage 4 = "Very Hard", Stage 5 = "Final Boss 🏆".

2. THE Stage_Page for Stage 1 SHALL display the following Puzzle content by default (editable by Admin):
   - **Type:** Binary Code Decoder
   - **Puzzle text:** "Decode the binary: `01001100 01000001 01000010`"
   - **Hint:** "Jahan computers kabhi sote nahi." *(Points to the Computer Lab)*

3. THE Stage_Page for Stage 2 SHALL display the following Puzzle content by default (editable by Admin):
   - **Type:** Mirror Text
   - **Puzzle text:** "ɹɐɹqᴉ˥ — Mirror ya phone ulta karke dekho."
   - **Hint:** *(Points to the Library — hint text editable by Admin)*

4. THE Stage_Page for Stage 3 SHALL display the following Puzzle content by default (editable by Admin):
   - **Type:** Password Challenge
   - **Puzzle text:** "Password has 8 characters. Starts with C. Ends with R. Contains 2026. (Computer or Technical Related)"
   - **Hint:** *(Points to next location — hint text editable by Admin)*

5. THE Stage_Page for Stage 4 SHALL display the following Puzzle content by default (editable by Admin):
   - **Type:** Caesar Cipher (+3 shift)
   - **Puzzle text:** "Decode using Caesar Cipher (+3 shift): `FRPSXWHU ODE`"
   - **Hint:** *(Points to next location — hint text editable by Admin)*

6. THE Stage_Page for Stage 5 SHALL display the following Puzzle content by default (editable by Admin):
   - **Type:** Final Boss — Word Assembly
   - **Puzzle text:** "You have collected word fragments from each previous QR. Arrange them in the order you visited and enter the combined code. (Remember: you were shown a word at each stage!)"
   - **No Hint** is displayed for Stage 5 as there is no next location.

7. THE Stage_Page for Stages 1 through 4 SHALL display a Word_Fragment after the Student arrives at that stage (i.e., after scanning the correct QR), with the following default values (editable by Admin):
   - Stage 1 Word_Fragment: **WI**
   - Stage 2 Word_Fragment: **N**
   - Stage 3 Word_Fragment: **N**
   - Stage 4 Word_Fragment: **ER**
   - The Stage_Page SHALL include the instruction: "Remember this word — you will need it at the Final Boss stage!"

8. THE Stage_Page SHALL display an Access_Code input field accepting exactly 6 alphanumeric characters; IF a Student submits fewer than 6 characters, THEN THE Application SHALL display the message "Access code must be 6 characters." and SHALL NOT submit to the server.

9. WHEN a Student enters the correct Access_Code (case-insensitive) for Stages 1–4 and submits, THE Application SHALL record the stage scan timestamp, mark the Stage as completed, and redirect the Student to the QR_Scanner for the next Stage.

10. IF a Student enters an incorrect Access_Code, THEN THE Application SHALL display the message "Incorrect access code. Please try again." and SHALL NOT advance progress.

11. WHEN a Student enters the correct Access_Code for Stage 5 and submits, THE Application SHALL display the Congratulations_Screen; once displayed it SHALL persist and THE Application SHALL NOT redirect away or show further errors for that session.

12. THE Admin_Panel SHALL allow the Admin to edit the Puzzle text, Hint text, Word_Fragment, and Access_Code for each Stage independently, with changes taking effect immediately for all subsequent Student requests.

---

### Requirement 6: Access Code Management

**User Story:** As an Admin, I want to set and change access codes for each stage, so that I can maintain security and control over the event.

#### Acceptance Criteria

1. THE Admin_Panel SHALL allow the Admin to view the current Access_Code for each of the 5 Stages.
2. THE Admin_Panel SHALL allow the Admin to update the Access_Code for any Stage at any time.
3. WHEN the Admin updates an Access_Code, THE Application SHALL use the new Access_Code for all subsequent Student submissions to that Stage only; Access_Codes for other Stages SHALL remain unchanged.
4. THE Admin_Panel SHALL validate that any new Access_Code is exactly 6 alphanumeric characters in length before saving.
5. IF the Admin submits an Access_Code that fails validation, THEN THE Admin_Panel SHALL display an error message specifying the constraint (e.g., "Access code must be exactly 6 alphanumeric characters.") and SHALL NOT save the invalid value.

---

### Requirement 7: Session and Dropout Rule

**User Story:** As an Admin, I want students who leave mid-hunt to be automatically deregistered, so that the event remains fair and database-clean.

#### Acceptance Criteria

1. WHEN a Student closes the browser tab or window while in an active Session, THE Application SHALL mark the Student's registration as cancelled in the Database.
2. IF a Student navigates to a URL outside the Application while in an active Session, THEN THE Application SHALL mark the Student's registration as cancelled in the Database.
3. IF a Student's Session has had no activity for more than 30 minutes, THEN THE Application SHALL expire the Session and mark the Student's registration as cancelled in the Database.
4. WHEN a Student's registration is cancelled due to any dropout cause, THE Application SHALL flag the Student's name and phone number as permanently ineligible so they cannot re-register or resume the hunt; the record SHALL be retained in the Database for audit purposes.
5. WHEN a Student's registration is cancelled, THE Application SHALL void all stage completion progress associated with that Student's Session.
6. IF a previously cancelled Student attempts to register again with the same name or phone number, THEN THE Registration_System SHALL reject the registration and display the message "Your registration was cancelled. You cannot re-register."
7. IF a Student with a cancelled registration attempts to access any Stage_Page directly via URL, THEN THE Application SHALL redirect them to the registration page and display the message "Your registration was cancelled. You cannot re-register."

---

### Requirement 8: Built-in QR Scanner

**User Story:** As a Student, I want to use the website's built-in camera to scan QR codes at stages 2–5, so that I don't need a separate app after the initial entry.

#### Acceptance Criteria

1. WHEN a Student reaches a Stage requiring a QR scan, THE QR_Scanner SHALL request camera permission from the Student's device.
2. IF the Student denies camera permission, THEN THE Application SHALL display the message "Camera access is required to scan QR codes. Please allow camera access and try again."
3. WHEN camera permission is granted, THE QR_Scanner SHALL activate the device's rear-facing camera for scanning; IF no rear-facing camera is available, THEN THE QR_Scanner SHALL fall back to the device's front-facing camera.
4. WHEN the QR_Scanner detects a valid QR code in the camera feed, THE Application SHALL process the QR code data within 2 seconds of detection.
5. WHEN the QR_Scanner is active with camera permission granted, THE QR_Scanner SHALL activate the camera, decode QR code data from the camera feed, and pass the decoded value to the Application for stage validation.
6. IF the QR_Scanner does not detect a valid QR code within 60 seconds of activation, THEN THE Application SHALL display a prompt asking the Student to reposition the camera or try again, without advancing or cancelling their progress.

---

### Requirement 9: Admin Panel — Participant Management and Live Progress

**User Story:** As an Admin, I want to view and manage all registered participants with a detailed live progress timeline, so that I can see exactly when each student started, how long they spent on each puzzle, and when they finished — all updating in real time during the event.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a live progress dashboard containing one row per registered participant showing: name, phone number, registration status ("active", "completed", or "cancelled"), current stage number (0–5), and a 5-segment visual progress bar where each filled segment represents a completed stage, each in-progress segment pulses or animates to indicate the student is currently on that stage, and empty segments represent未started stages.

2. THE Admin_Panel SHALL update each participant's progress bar and timestamps within 5 seconds of any stage completion event, without requiring the Admin to manually refresh the page.

3. EACH participant row in the live progress dashboard SHALL display the following timestamps inline or in an expandable detail panel:
   - **Started:** the server timestamp when the student's registration was accepted (i.e., event start time for that student)
   - **Stage 1 completed at:** server timestamp of Stage 1 Access_Code submission (or "—" if not yet reached)
   - **Stage 2 completed at:** server timestamp of Stage 2 Access_Code submission (or "—")
   - **Stage 3 completed at:** server timestamp of Stage 3 Access_Code submission (or "—")
   - **Stage 4 completed at:** server timestamp of Stage 4 Access_Code submission (or "—")
   - **Stage 5 completed at / Ended:** server timestamp of Stage 5 Access_Code submission (or "—")
   - **Total time elapsed:** live-updating duration from registration timestamp to current server time for active participants; fixed duration from registration to Stage 5 completion for finished participants; displayed as HH:MM:SS.

4. THE Admin_Panel SHALL display the time spent on each individual stage as a sub-row or tooltip per participant, calculated as: Stage N completion timestamp minus Stage (N-1) completion timestamp (or registration timestamp for Stage 1), formatted as MM:SS; for the stage a student is currently on, this SHALL show a live-updating elapsed timer counting up from when they entered that stage.

5. THE Admin_Panel SHALL visually distinguish: active participants (currently solving a stage) shown with a pulsing indicator, completed participants (all 5 stages done) shown with a gold/green "Completed" badge, and cancelled participants shown with a grey "Cancelled" label.

6. THE Admin_Panel SHALL display the following live summary counts at the top of the dashboard, updating within 5 seconds of any change: total registered, currently active, completed all stages, cancelled; and number of participants currently at each Stage (1 through 5).

7. THE Admin_Panel SHALL allow the Admin to filter the dashboard by status: "All", "Active", "Completed", or "Cancelled".

8. THE Admin_Panel SHALL allow the Admin to sort the dashboard by: participant name (A–Z), current stage progress (highest first), total elapsed time (fastest first), or registration time (earliest first); the default sort SHALL be current stage progress descending, then total elapsed time ascending as tiebreaker.

9. WHEN the Admin initiates a manual cancellation for a participant, THE Admin_Panel SHALL set that participant's status to "cancelled" in the Database and terminate their active Session; WHEN the operation completes, THE Admin_Panel SHALL display a confirmation message.

10. IF the Admin-initiated cancellation fails due to a system error, THEN THE Admin_Panel SHALL display an error message and leave the participant's status unchanged.

11. THE Admin_Panel SHALL display the total count of all-time registered participants and the count with status "active" in the dashboard header summary.

---

### Requirement 10: Ban List Management

**User Story:** As an Admin, I want to ban participants by name and/or phone number, so that disruptive or ineligible individuals cannot register.

#### Acceptance Criteria

1. THE Admin_Panel SHALL allow the Admin to add an entry to the Ban_List specifying a name, a phone number, or both; IF the Admin submits an entry with neither a name nor a phone number, THEN THE Admin_Panel SHALL reject the submission and display an error message "At least one of name or phone number is required."
2. THE Admin_Panel SHALL display all current Ban_List entries, showing the banned name (if present) and the banned phone number (if present) for each entry.
3. THE Admin_Panel SHALL allow the Admin to remove any entry from the Ban_List.
4. WHEN a Ban_List entry is added, THE Registration_System SHALL apply the ban for the next registration attempt without requiring a restart or page reload.
5. IF a Ban_List entry is removed and no other ban or duplicate restriction applies to the corresponding name or phone number, THEN THE Registration_System SHALL allow registration attempts using that name or phone number for the next submission.
6. IF the Admin attempts to add a Ban_List entry where both the name and phone number exactly match an existing Ban_List entry (case-insensitive for name), THEN THE Admin_Panel SHALL reject the submission and display a message "This entry already exists in the ban list."

---

### Requirement 11: Admin Panel — Content Management

**User Story:** As an Admin, I want to edit puzzles, hints, and access codes for each QR stage, so that I can customise the event content without developer intervention.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display an editable form for each of the 5 Stages containing fields for: Puzzle text (maximum 2000 characters), Hint text (maximum 500 characters), and Access_Code.
2. WHEN the Admin saves changes to a Stage, THE Application SHALL serve the updated Puzzle, Hint, or Access_Code to Students from that moment onward.
3. IF the Admin attempts to save a Stage where the Puzzle field is empty or contains only whitespace, THEN THE Admin_Panel SHALL reject the save and display an error message "Puzzle cannot be empty."
4. IF the Admin attempts to save a Stage (1 through 4) where the Hint field is empty or contains only whitespace, THEN THE Admin_Panel SHALL reject the save and display an error message "Hint cannot be empty for this stage."
5. THE Admin_Panel SHALL allow the Hint field for Stage 5 to be left empty or blank, as there is no next stage to hint toward.

---

### Requirement 12: Admin Panel — Authentication and Security

**User Story:** As an Admin, I want the Admin Panel to be password-protected, so that only authorised personnel can manage the event.

#### Acceptance Criteria

1. THE Admin_Panel SHALL require the Admin to authenticate with a username (minimum 4 characters) and password (minimum 8 characters) before accessing any administrative function.
2. IF an unauthenticated request is made to any Admin_Panel route, THEN THE Admin_Panel SHALL redirect the request to the admin login page.
3. IF the Admin's session has had no activity for more than 8 hours, THEN THE Admin_Panel SHALL invalidate the session and redirect the Admin to the admin login page on their next request.
4. IF a connection to any Admin_Panel route uses HTTP instead of HTTPS, THEN THE Admin_Panel SHALL redirect the request to the equivalent HTTPS URL.
5. IF a connection to any student-facing Application route uses HTTP instead of HTTPS, THEN THE Application SHALL redirect the request to the equivalent HTTPS URL.
6. THE Database SHALL NOT be directly accessible from the public internet; all Database interactions SHALL occur server-side only.
7. IF an Admin login attempt fails, THE Admin_Panel SHALL record the failure; IF 5 consecutive failed login attempts occur from the same IP address within 10 minutes, THEN THE Admin_Panel SHALL block further login attempts from that IP address for 15 minutes and display a message "Too many failed attempts. Please try again later."

---

### Requirement 13: Congratulations Screen

**User Story:** As a Student, I want to see a congratulations message after completing all 5 stages, so that I know I have won and understand the next step.

#### Acceptance Criteria

1. WHEN a Student enters the correct Access_Code for Stage 5 and submits, THE Application SHALL display the Congratulations_Screen.
2. THE Congratulations_Screen SHALL display the message: "Please come over to Jagdish Thakur (President) for the Winner Confirmation."
3. THE Congratulations_Screen SHALL display the Student's registered name.
4. WHEN the Congratulations_Screen is first displayed for a Student, THE Application SHALL record the Student's name and the server timestamp in the Database as a completion record; IF the Database write fails, THEN THE Application SHALL still display the Congratulations_Screen and retry the write up to 3 times before logging the failure.
5. IF a Student navigates back to the Congratulations_Screen URL after it has already been displayed, THEN THE Application SHALL display the Congratulations_Screen again without creating a duplicate completion record in the Database.
6. THE Admin_Panel SHALL display a list of completed participants sorted by completion timestamp in ascending order, showing each participant's name and completion timestamp.

---

### Requirement 14: Mobile-First Responsive Design

**User Story:** As a Student, I want the Application to work seamlessly on my smartphone, so that I can use it throughout the campus event without issues.

#### Acceptance Criteria

1. THE Application SHALL render all student-facing pages without horizontal scrolling on screen widths from 320px to 1920px.
2. THE Application SHALL render all interactive elements (buttons, input fields, links) with a minimum tap target size of 44×44 CSS pixels on all student-facing pages.
3. THE Application SHALL complete the initial load of the registration page, including all visible above-the-fold content, within 3 seconds when measured on a connection with a download speed of at least 20 Mbps (approximate 4G average).
4. THE Application SHALL NOT require the Student to install a native app or browser extension; it SHALL function entirely within a standard mobile web browser.
5. THE Application SHALL render all body text at a minimum font size of 14px CSS on mobile viewports (width ≤ 480px), ensuring legibility at the browser's default zoom level.

---

### Requirement 15: Data Persistence and Integrity

**User Story:** As an Admin, I want all event data to be reliably stored, so that participant records and event configuration are not lost.

#### Acceptance Criteria

1. THE Database SHALL persist all participant registrations, stage completion records, ban list entries, event configuration, and stage content across server restarts.
2. WHEN a Student's registration is cancelled due to dropout or admin-initiated cancellation, THE Database SHALL retain a cancellation record containing the Student's name, phone number, stage number at the time of cancellation, cancellation reason (dropout or admin-manual), and cancellation timestamp for audit purposes.
3. WHEN a Student submits an Access_Code for a Stage, THE Application SHALL record at most one completion record per Student per Stage; IF a completion record for that Student and Stage already exists, THEN THE Application SHALL treat the submission as a duplicate and SHALL NOT create a second record.
4. IF a Student submits an Access_Code for a Stage for which a completion record already exists in the Database, THEN THE Application SHALL reject the duplicate submission and display the message "This stage has already been completed."
5. THE Admin_Panel SHALL provide a mechanism to export all participant data as a CSV file containing at minimum the following columns: name, phone number, registration status, current stage progress, stage completion timestamps (one column per stage), cancellation timestamp (if applicable).

---

### Requirement 16: Dynamic Styled QR Code Generation and QR Card Layout

**User Story:** As an Admin, I want 6 visually styled QR codes (1 Registration QR + 5 Puzzle QRs) with the college logo embedded and printable cards showing the access code and word fragment, so that the printed QR stations are professional, branded, and self-contained for students.

#### Acceptance Criteria

1. WHEN the Admin_Panel loads the QR code management section for the first time or when no Styled_QR exists, THE Admin_Panel SHALL automatically generate all 6 QR codes — 1 Registration_QR (encoding the registration page URL) and 5 Puzzle_QRs (one per stage, encoding each stage's unique URL) — using the URLs already stored in the Database.

2. THE Registration_QR and all 5 Puzzle_QRs SHALL each be rendered as a Styled_QR using at least one non-black foreground color or a color gradient so each is visually distinct from a plain black-and-white QR code.

3. THE Admin_Panel SHALL embed the college logo image (sourced from https://i.postimg.cc/c1cHCbHX/Whats-App-Image-2026-07-31-at-6-24-50-PM.jpg) as a centered overlay in the standard QR error-correction logo slot of each Styled_QR; the logo overlay SHALL NOT exceed 30% of the QR code's total dimension in either width or height.

4. THE Admin_Panel SHALL render the college logo image as a background watermark layer behind the QR code pattern at an opacity between 10% and 15%, so that it is visible but does not obscure the QR data modules.

5. WHEN a Styled_QR is generated, THE Admin_Panel SHALL verify that the QR code is decodable; IF the QR code fails the decodability check, THEN THE Admin_Panel SHALL automatically increase the error correction level (up to level H) or reduce the logo overlay size and retry; IF the code remains undecodable after 3 adjustment attempts, THEN THE Admin_Panel SHALL display an error message to the Admin and SHALL NOT present the undecodable code for download.

6. THE Admin_Panel SHALL generate a printable QR_Card for each of the 5 Puzzle_QRs (QR 1–5) that contains:
   - The Styled_QR image centred on the card.
   - The stage's 6-character Access_Code printed in large, legible text directly below the QR image.
   - The stage's Word_Fragment printed below the Access_Code (for Stages 1–4 only; Stage 5 has no Word_Fragment to display on the card).
   - The Registration_QR card SHALL show only the QR image and the label "Scan to Register" — no access code or word fragment.

7. WHEN the Admin clicks the download button for any QR, THE Admin_Panel SHALL provide the QR_Card as a downloadable PNG file with a minimum resolution of 1000×1000 pixels.

8. WHEN the event URL, any stage URL, any Access_Code, or any Word_Fragment changes, THE Admin_Panel SHALL automatically regenerate the affected QR_Card(s) and replace the previously generated versions.

---

### Requirement 17: QR Code Time-Lock with Countdown Timer

**User Story:** As a Student, I want to see a countdown timer if I scan a QR code before the event starts, so that I know exactly when to come back rather than seeing a confusing error.

#### Acceptance Criteria

1. WHEN a Student opens any of the 5 QR code URLs, THE Application SHALL request the current server time from the server within 1 second of page load and compare it against the stored Event_Window before rendering any event content; IF the server time request fails or times out after 5 seconds, THEN THE Application SHALL display a message "Unable to verify event status. Please check your connection and try again." and SHALL NOT render any event content.
2. IF a Student opens any QR code URL and the current server time is before the Event_Window start date/time, THEN THE Application SHALL display the QR_Countdown_Page showing a live countdown timer with days, hours, minutes, and seconds remaining until the event start, updating every second on the client.
3. THE QR_Countdown_Page SHALL display the college branding (college logo and college name) and a message stating "The event hasn't started yet. Come back when the timer hits zero!".
4. THE countdown timer on the QR_Countdown_Page SHALL be initialised using the server time returned in the initial query and SHALL re-sync with the server every 60 seconds to correct any client-side drift, so that adjusting the client device clock does not permanently alter the displayed countdown.
5. WHEN the countdown timer on the QR_Countdown_Page reaches zero, THE Application SHALL automatically redirect the Student to the appropriate page for that QR code (registration page for QR 1, or the active stage flow for QR 2–5) without requiring a manual page refresh.
6. IF a Student opens any QR code URL and the current server time is after the Event_Window end date/time, THEN THE Application SHALL display a message stating that the event has ended, without showing a countdown timer.
7. WHILE the current server time is within the Event_Window, THE Application SHALL proceed normally when a QR code URL is opened, according to the QR code flow rules defined in Requirement 4, with no countdown page displayed.

---

### Requirement 18: Stage Timestamp Recording and Leaderboard

**User Story:** As a Student I want my time at each QR stage recorded automatically, and as an Admin I want a ranked leaderboard with full per-stage timing breakdowns, so that the fastest accurate solver can be identified fairly and the event can be analysed after it ends.

#### Acceptance Criteria

1. WHEN a Student's registration is accepted, THE Application SHALL record the server timestamp as that Student's **Registration Timestamp** (event start time for that student) in the Database.

2. WHEN a Student successfully submits the correct Access_Code for any Stage (1 through 5), THE Application SHALL immediately record the server timestamp as the **Stage N Completion Timestamp** for that Student in the Database; this write SHALL be atomic — if the write fails, THE Application SHALL retry up to 3 times before logging the failure, and SHALL still allow the student to progress.

3. THE Application SHALL derive the following per-student timing values from stored timestamps (these are computed, not separately stored):
   - **Time on Stage N** = Stage N Completion Timestamp − Stage (N−1) Completion Timestamp; for Stage 1, Stage (N−1) Completion Timestamp = Registration Timestamp.
   - **Total Elapsed Time** = Stage 5 Completion Timestamp − Registration Timestamp.

4. WHEN a Student completes Stage 5, THE Application SHALL add them to the Leaderboard ranked by Total Elapsed Time ascending (shortest = rank 1).

5. THE Congratulations_Screen SHALL display:
   - The student's Total Elapsed Time (formatted as H:MM:SS).
   - Their current Leaderboard rank and position (e.g., "You are #2 on the leaderboard!").
   - The top 10 Leaderboard entries showing rank, name, and Total Elapsed Time; IF fewer than 10 finishers exist all shall be shown.

6. THE Admin_Panel Leaderboard view SHALL show all finishers ranked by Total Elapsed Time ascending, with columns: Rank, Name, Phone, Registration Time, Stage 1–5 individual completion times, Time spent on each Stage (MM:SS), Total Elapsed Time.

7. THE Admin_Panel live progress dashboard SHALL show for each active participant a live-updating "Time on current stage" counter — a timer counting up in HH:MM:SS from the moment they entered the current stage — so the Admin can see in real time how long a student has been stuck on a particular puzzle.

8. THE Leaderboard in the Admin_Panel SHALL update within 5 seconds of a new finisher being recorded, without requiring a manual page refresh.

9. IF two Students share the same Total Elapsed Time to the nearest second, THEN THE Leaderboard SHALL show them at the same rank ordered alphabetically by name as a tiebreaker.

10. THE Admin_Panel SHALL allow the Admin to export the full Leaderboard as a CSV file with columns: rank, name, phone, registration timestamp, Stage 1–5 completion timestamps, Stage 1–5 individual durations (MM:SS), total elapsed time.

---

### Requirement 19: Event Reset and Re-Run

**User Story:** As an Admin, I want to reset the event and run it again on a different date, so that the same treasure hunt can be conducted multiple times without rebuilding the application.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide an "Reset Event" action in the event scheduling section that, when confirmed, performs the following in a single atomic operation:
   - Permanently deletes all participant records and their stage completion records.
   - Permanently deletes all student session records.
   - Resets the event start and end date/time to empty (unset) so the Admin can configure fresh dates.
   - Clears the leaderboard.
   - Retains all stage content (puzzles, hints, access codes, word fragments), the ban list, admin credentials, and QR codes — these do NOT change.

2. THE Admin_Panel SHALL require the Admin to type the confirmation phrase "RESET EVENT" exactly (case-sensitive) into a text field before the Reset action becomes executable, to prevent accidental resets.

3. WHEN an event reset is performed, THE Admin_Panel SHALL record an audit log entry containing: the admin username who performed the reset, the timestamp, and the count of participants deleted.

4. AFTER a reset, THE Application SHALL behave as if it is a fresh event — students can register again (including those who participated in the previous run), and the event only starts once the Admin sets new start/end dates and the Event_Window begins.

5. THE Admin_Panel SHALL display the history of past resets (date of reset, admin who performed it, participant count deleted) in a read-only Reset History log accessible from the event scheduling section.

---

### Requirement 20: Admin — Student Deletion and Progress Reset

**User Story:** As an Admin, I want to permanently delete a student and all their associated progress data, so that I can correct data errors, remove test entries, or handle special cases during event management.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a "Delete Student" action for each participant in the participant list and live progress dashboard; the action SHALL require an explicit confirmation step (e.g., a confirmation dialog displaying the student's name and phone number) before executing.

2. WHEN the Admin confirms deletion of a student, THE Application SHALL permanently remove from the Database: the participant record, all stage completion records for that participant, the student session record, and any cancellation record associated with that participant.

3. WHEN a student is deleted, THE Application SHALL immediately release that student's name and phone number so that another person (or the same person) can register with those credentials in the current Active_Edition.

4. WHEN a student is deleted, THE Application SHALL immediately terminate any active Session associated with that student; IF that student's browser subsequently makes any API request, THE Application SHALL return a 401 response.

5. THE Admin_Panel SHALL update the live progress dashboard and leaderboard within 5 seconds of a student being deleted, removing the deleted student from all views without requiring a manual refresh.

6. THE Admin_Panel SHALL allow the Admin to delete multiple students in a single bulk action by selecting multiple rows and clicking "Delete Selected"; a single confirmation dialog SHALL list all selected names before executing.

7. WHEN a student is deleted, THE Application SHALL record an audit log entry in the Database containing: the deleted student's name, phone number, stage progress at time of deletion, deletion timestamp, and the admin username who performed the deletion; this audit log SHALL NOT be deleted when the student record is deleted.

8. THE Admin_Panel SHALL provide access to the deletion audit log as a read-only view, sortable by timestamp and filterable by edition.

9. THE Admin_Panel SHALL allow the Admin to reset a student's progress (clear all stage completion records) WITHOUT deleting the registration; WHEN a progress reset is performed, the student's current stage SHALL revert to Stage 1 and all stage completion timestamps SHALL be removed, but the participant record and session SHALL remain active.

10. WHEN a student's progress is reset, THE Application SHALL update the live progress dashboard and leaderboard within 5 seconds to reflect the reset state.

---

### Requirement 21: Admin Site Map Page

**User Story:** As an Admin, I want a single page that lists every page and route the website has, categorized and described, so that I can understand the full structure of the application at a glance.

#### Acceptance Criteria

1. THE Admin_Panel SHALL provide a route `/admin/sitemap` accessible only to authenticated Admins that displays every URL route in the Application, grouped into the following categories:
   - **Student-Facing Pages** (e.g., Registration, Stage pages, Countdown, Congratulations)
   - **Admin Panel Pages** (e.g., Dashboard, Live Progress, Leaderboard, Content Management, QR Management, Ban List, Event Scheduling, Participants, Audit Log, Site Map)
   - **API Endpoints** (grouped by Student API and Admin API)

2. EACH route entry in the sitemap SHALL display: the URL path, the page/endpoint name, a one-line description of its purpose, and the access level required (Public / Student Session / Admin Auth).

3. THE sitemap page SHALL be linked from the Admin Panel navigation so the Admin can reach it from any admin page.

4. THE sitemap SHALL be generated from the application's actual registered routes, not a manually maintained list, so it stays accurate as routes are added or changed.
