# Working on Idioma

## Every change goes through a pull request

- Never commit or push straight to `main`, and never merge a branch into
  `main` locally. Pushing to `main` deploys to GitHub Pages, which is the app
  on the phone.
- Do new work on its own branch, push it, and open a pull request for it.
  Separate pieces of work get separate pull requests.
- Merge only when asked, and only through the pull request.

## The learner's progress is not in the repo

Progress lives in the browser's localStorage under `idioma.state.v1`, on each
device separately. Nothing in a deploy can restore it once it is gone.

- Never tell the user to delete, reinstall or re-add the home-screen app, or
  to clear site data, without first telling them to Export a backup. On an
  iPhone, a home-screen app has its own storage, separate from Safari, and
  removing it deletes that storage.
- Any change to the stored state's shape needs a migration that keeps
  existing progress, and a test that loads old saved state.
