---
tags:
  - all
  - email-task
created: {{created_date}}
from: {{from_email}}
subject: {{subject}}
email_id: {{email_id}}
source: {{source}}
---

## 🗒 Tasks in this note
```tasks
path includes {{query.file.path}}
not done
sort by due
sort by priority


```

---
## 📧 Email
**From:** {{from_name}} <{{from_email}}>
**Date:** {{email_date}}
**Subject:** {{subject}}
{{#if original_link}}[Open in {{source}}]({{original_link}}){{/if}}

{{email_body}}

---
## Notes
*To do items will all be collected at the top of the note.*
- [ ] Review and process this email
- [ ]
