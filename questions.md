

## Questions for the Client


### About the Business

1. How many learners do you currently have active? How many do you expect in the first year?
2. What types of qualifications do you deliver? (NVQ, Apprenticeships, BTEC, or a mix?)
3. Are you currently using another platform or tool to manage portfolios? If yes, what don't you like about it?
4. When you sell the platform to other training providers — do they manage their own learners independently, or do you stay involved?
5. Do you have an existing brand (logo, colours) you want applied to the platform?

---

### About Users & Roles

6. Do you need an IQA role from day one, or can that come later?
7. Will assessors be employed by you, or are some freelance/external?
8. Do you need an Employer Portal — where the employer of an apprentice can log in and see progress?
9. Do you work with any Awarding Organisations (e.g. Pearson, City & Guilds, NCFE)? Do they need access to the platform?

---

### About Qualifications & Features

10. Do you need End Point Assessment (EPA) management, or just the portfolio building process?
11. Do you need the Off-the-Job Training tracker? (This is a legal requirement for Apprenticeships — 20% rule)
12. What types of evidence do learners submit? Documents and images only, or also video and audio?
13. What is the maximum file size a learner would upload? (e.g. a video file could be 500MB+)
14. Do learners need to sign plans electronically inside the platform, or is email confirmation enough?
15. Do you use any existing systems we would need to integrate with? (e.g. Maytas, Aptem, ProSolution, or any HR/MIS system)

---

### About Timeline & Expectations

16. For the September pilot — how many learners and assessors do you want to run with initially?
17. What is the absolute minimum the platform must do for you to consider the pilot a success?
18. After October, how many new training centres do you plan to onboard in the first 3 months?
19. What is your budget for the project? (Fixed total, or monthly retainer?)
20. Do you prefer a fixed-price contract or time-and-materials?

---

### About Compliance

21. Are you aware of UK GDPR requirements for the platform? Do you have a Data Protection Officer (DPO)?
22. Do you need the platform to be hosted specifically in the UK, or is EU hosting acceptable?


---


## Questions for Victor


### Architecture

- Monolith or separate frontend/backend?
- For multi-tenancy — one database per client, or all in one database separated by tenant ID?
- Next.js for everything, or React + NestJS separately?

---

### Database & Backend

- TypeORM or Prisma?
- How should we handle file uploads and storage?
- What auth approach do you recommend?
- How strict should we be with RBAC from day one?

---

### Dev Workflow

- Do you review every PR or just the big stuff?
- Should I set up CI/CD from day one, or get the MVP done first?
- How much testing do you expect from me given the timeline?


---

### Infrastructure

- Where should we host this?
- Docker from day one, or later?
- Do we need a staging environment before the pilot launch?

