# Moving a school's files from Supabase Storage to Cloudflare R2

Do this once per school that already has uploaded files (today, the staging
school). A new school starts on R2 and has nothing to move.

The database does not change. The `file_url`, `avatar_url` columns hold the path
_inside_ a folder (for example `<topicId>/<uuid>.pdf`). `lib/storage.ts` adds the
folder, so the R2 object key is `<folder>/<stored path>`, where the folder is the
old Supabase bucket name:

| Old Supabase bucket    | R2 key prefix                           |
| ---------------------- | --------------------------------------- |
| `homework-submissions` | `homework-submissions/`                 |
| `topic-resources`      | `topic-resources/`                      |
| `student-photos`       | `student-photos/`                       |
| `library-assets`       | `library-assets/` (no code uses it yet) |

**Not tested against a real project.** These steps follow the plan (full plan,
section 4.5). Rehearse on a scratch bucket first.

## Before you start

1. Create the school's R2 bucket (private) and an access key limited to that
   bucket with Object Read & Write. Put the four `R2_*` values in the school's
   env file (`deploy/school.env.example`).
2. In the Supabase dashboard (Project Settings, Storage), enable the S3
   connection and create an S3 access key. Note the endpoint
   (`https://<project-ref>.supabase.co/storage/v1/s3`) and region.
3. Install rclone.

## Copy

Create two rclone remotes (`rclone config`, or the config file):

```ini
[supa]
type = s3
provider = Other
access_key_id = <supabase S3 access key id>
secret_access_key = <supabase S3 secret>
endpoint = https://<project-ref>.supabase.co/storage/v1/s3
region = <project region>

[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = <R2_ENDPOINT>
acl = private
no_check_bucket = true
```

Copy each bucket into the matching folder (dry run first):

```sh
for b in homework-submissions topic-resources student-photos library-assets; do
  rclone copy "supa:$b" "r2:<R2_BUCKET>/$b" --dry-run
done
# then without --dry-run
```

## Verify, then switch

1. Compare counts and sizes per folder:
   `rclone size supa:<bucket>` against `rclone size r2:<R2_BUCKET>/<bucket>`.
   They must match exactly.
2. Spot-check a few rows: take a `file_url` from `topic_resources` and a
   `profiles.avatar_url`, and confirm `<folder>/<value>` exists in R2
   (`rclone lsl r2:<R2_BUCKET>/topic-resources/<value>`).
3. Deploy the version of the app that uses R2, and open a student photo, a topic
   resource and a homework submission.
4. Keep the Supabase buckets, untouched, until the school has run on R2 for the
   retention period you chose. Uploads made _during_ the cut-over window land in
   Supabase if the old version is still running: run `rclone copy` once more
   right after the switch to catch them.
5. Only then delete the Supabase buckets.
