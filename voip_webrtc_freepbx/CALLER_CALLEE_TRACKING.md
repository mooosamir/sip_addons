# Caller and Callee Tracking Enhancement

## Overview
Enhanced the `voip.recording` model to automatically track both caller and callee information for each call recording, supporting both internal users and external contacts.

## New Fields Added

### Caller Information
- **caller_user_id** (Many2one → res.users)
  - Tracks the internal user who initiated the call
  - Automatically populated when the caller is a VoIP user in the system

- **caller_partner_id** (Many2one → res.partner)
  - Tracks the external contact/customer who initiated the call
  - Automatically populated by matching phone numbers to partner records

- **caller_display** (Char - computed)
  - User-friendly display name showing who the caller was
  - Shows user name or partner name, or phone number if neither found

### Callee Information
- **callee_user_id** (Many2one → res.users)
  - Tracks the internal user who received the call
  - Automatically populated when the callee is a VoIP user in the system

- **callee_partner_id** (Many2one → res.partner)
  - Tracks the external contact/customer who received the call
  - Automatically populated by matching phone numbers to partner records

- **callee_display** (Char - computed)
  - User-friendly display name showing who the callee was
  - Shows user name or partner name, or phone number if neither found

## Automatic Population Logic

### When Creating a Recording

1. **System checks call direction** (inbound/outbound)
2. **Identifies caller**:
   - If outbound call → caller is the internal VoIP user
   - If inbound call → searches for partner by from_number
   - Also checks if the number matches an internal SIP username

3. **Identifies callee**:
   - If inbound call → callee is the internal VoIP user
   - If outbound call → searches for partner by to_number
   - Also checks if the number matches an internal SIP username

### Phone Number Matching

The system searches for contacts using:
- Phone field (`res.partner.phone`)
- Mobile field (`res.partner.mobile`)
- VoIP SIP username (`voip.user.sip_username`)
- Multiple format variations (with/without spaces, dashes, parentheses)

## UI Changes

### Form View
Added two new groups:
- **Caller Information** group showing:
  - Caller Display (summary)
  - Caller User (if internal)
  - Caller Contact (if external)

- **Callee Information** group showing:
  - Callee Display (summary)
  - Callee User (if internal)
  - Callee Contact (if external)

### List View
Added columns:
- **Caller** (caller_display)
- **Callee** (callee_display)

### Search/Filter View
Enhanced with:
- Search by caller_user_id
- Search by caller_partner_id
- Search by callee_user_id
- Search by callee_partner_id
- Group by Caller (User)
- Group by Caller (Contact)
- Group by Callee (User)
- Group by Callee (Contact)

## Use Cases

### Internal to External Call (Outbound)
- **Scenario**: Employee calls a customer
- **Result**:
  - `caller_user_id` = Employee's res.users record
  - `callee_partner_id` = Customer's res.partner record
  - `caller_display` = "Employee Name (User)"
  - `callee_display` = "Customer Name (Contact)"

### External to Internal Call (Inbound)
- **Scenario**: Customer calls employee
- **Result**:
  - `caller_partner_id` = Customer's res.partner record
  - `callee_user_id` = Employee's res.users record
  - `caller_display` = "Customer Name (Contact)"
  - `callee_display` = "Employee Name (User)"

### Internal to Internal Call
- **Scenario**: Employee calls another employee
- **Result**:
  - `caller_user_id` = First employee's res.users record
  - `callee_user_id` = Second employee's res.users record
  - `caller_display` = "Employee 1 Name (User)"
  - `callee_display` = "Employee 2 Name (User)"

### External to External Call (Transfer/Conference)
- **Scenario**: External call transferred to another external party
- **Result**:
  - `caller_partner_id` = First contact's res.partner record
  - `callee_partner_id` = Second contact's res.partner record
  - `caller_display` = "Contact 1 Name (Contact)"
  - `callee_display` = "Contact 2 Name (Contact)"

## Technical Implementation

### Model Method: `_identify_caller_callee()`
```python
def _identify_caller_callee(self, phone_number, is_internal, odoo_user):
    """
    Identifies whether a phone number belongs to:
    1. Internal user (if is_internal=True)
    2. External partner (by phone matching)
    3. Internal SIP username (by voip.user.sip_username)
    """
```

### Override: `create()`
```python
@api.model_create_multi
def create(self, vals_list):
    """
    Automatically populates caller/callee fields on recording creation
    based on the associated voip.call record
    """
```

### Compute Method: `_compute_caller_callee_display()`
```python
@api.depends('caller_user_id', 'caller_partner_id', 'callee_user_id', 
             'callee_partner_id', 'call_id.from_number', 'call_id.to_number')
def _compute_caller_callee_display(self):
    """
    Creates user-friendly display names for caller and callee
    showing the most relevant information available
    """
```

## Files Modified

1. **models/voip_recording.py**
   - Added 6 new fields (4 relational + 2 computed)
   - Added `create()` override
   - Added `_identify_caller_callee()` helper method
   - Added `_compute_caller_callee_display()` compute method

2. **views/voip_recording_views.xml**
   - Updated form view with two new information groups
   - Updated tree view with caller_display and callee_display columns
   - Updated search view with new search fields and group-by options

## Benefits

1. **Complete Call History**: Track both parties involved in every call
2. **Automatic Identification**: No manual data entry required
3. **Smart Matching**: Automatically links to existing contacts and users
4. **Flexible Search**: Find recordings by any party involved
5. **Better Reporting**: Group and analyze recordings by caller/callee
6. **CRM Integration**: Direct links to customer records (res.partner)
7. **User Accountability**: Clear tracking of which employees made/received calls

## Upgrade Instructions

1. Stop Odoo server
2. Run upgrade command:
   ```bash
   cd /work/odoo17
   .venv/bin/python odoo-bin --addons-path=addons,client/sip_addons \
       -d 17_odoo_voip_webrtc_freepbx \
       -u voip_webrtc_freepbx \
       -c odoo.conf
   ```
3. Restart Odoo server
4. Existing recordings will have empty caller/callee fields (you can optionally populate them using a migration script)
5. All new recordings will automatically have these fields populated

## Future Enhancements

Potential future additions:
- Migration script to populate existing recordings
- Smart suggestions for unmatched phone numbers
- Integration with CRM activities
- Call analytics dashboard with caller/callee metrics
- Auto-create partner records for unknown external numbers

