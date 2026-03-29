# ResearchHub

ResearchHub is a client-side personal paper management web app for organizing, tracking, and reviewing research papers.

## Features

- Dashboard analytics (status distribution, timeline, top tags)
- Library table with search, filters, sorting, and pagination
- Add Paper workflows:
  - Manual entry
  - BibTeX import
  - DOI lookup
  - File upload
  - RIS import
- Kanban board by status
- Collections and tags
- Quality checks and duplicate detection
- Extraction templates with CSV export
- Local-first storage with IndexedDB (Dexie)

## What's new

- Implemented the **Add Paper** section so the sidebar route now opens a dedicated page with quick actions for each add workflow.
- Added support for opening the Add Paper modal directly to a selected tab.

## Run locally

This project is a static web app (no build step required).

1. Open `/home/runner/work/ResearchHub/ResearchHub/index.html` in a browser, or
2. Serve the repository with any static file server.

## Notes

- Data is stored in your browser (IndexedDB).
- External libraries are loaded via CDN from `index.html`.
