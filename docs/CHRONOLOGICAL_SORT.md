# Default ordering: newest tests first

Updated 2026-09-05, based on main@d070dc8d5c439c8d11724faaf064fdc1b6ba3e4f.

The default option is now **时间：新 → 旧**. It sorts all providers together
by descending timestamp, including after search/provider/protocol filtering.
The existing `sort=default` URL value remains compatible; clearing filters
returns to this chronological order. Explicit A–Z options are unchanged.
Equal times retain the original manifest order; entries without any valid
time follow all dated entries. Older deployed manifests without time fields
still load and retain their original order.

### Time provenance

1. A maintainer-recorded `testedAt` in `pages/test-times.json` is authoritative
   for the last actual test. Re-testing a work can move an older submission to
   the front. Record the real test completion time, not the commit/build time.
2. When there is no test record, `submittedAt` is derived from the first Git
   commit adding a file in the work's current directory. This is explicitly a
   **first-submission fallback, not evidence of when a test took place**.
   Using the directory, rather than `submission.json`, preserves history for
   works whose metadata was added retroactively.
3. No timestamps are fabricated for old entries. The registry starts empty.
   No-history source archives retain unknown submission dates with a warning.
   A shallow checkout is rejected instead of treating its boundary commit as
   every entry's creation date. Both deployment and UI-check workflows fetch
   complete history (`fetch-depth: 0`).

`withSubmissionTimes` adds optional `testedAt`/`submittedAt` fields to the
existing generated public manifest. Entrant metadata, isolation rules,
README indexing, provider/model order values and contestant code are unchanged.
No browser request to GitHub or runtime backend is required.

Maintainers can record an actual completed test by adding the entry ID and
an ISO timestamp with explicit timezone to the existing registry. Format
illustration only (not a real test record):

```json
{
  "schemaVersion": 1,
  "testedAt": {
    "provider/model-slug": "2026-09-05T13:30:00+08:00"
  }
}
```

Use an actual existing entry ID and actual test time. Invalid dates, unknown
IDs and malformed registries fail the build rather than silently distorting
the order. Times are normalized to UTC, and the detail dialog displays both
the effective timestamp and whether it came from a test record or the
first-submission fallback. Routine metadata edits and site redeployments do
not refresh historical submission dates. Renamed directories use the history
of their current path; accurate test timestamps should be recorded explicitly.

### Follow-up verification

Executed locally against this update: **32 Node tests and 44 offline Chromium
browser checks passed**. Added checks cover cross-provider chronology, later
retests, composed filters, resets, legacy URLs/manifests, missing/invalid/equal
times, explicit timezone normalization, Git-history enrichment, retroactive
metadata, archive fallback and rejection of shallow history. Browser checks
also verify the new label and truthful time provenance in the detail dialog.

The UI workflow additionally validates timeline generation against the real
repository and prints the resulting order. This is separate from the local
synthetic Git fixtures. Full game builds and production deployment are not
claimed by the local checks. The earlier browser-coverage limitations still
apply.
