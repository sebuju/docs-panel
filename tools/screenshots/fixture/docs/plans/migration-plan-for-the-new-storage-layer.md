# Migration plan

The storage layer moves in three steps; the review comes first. The dates are in plans/roadmap.md and the decisions behind them in meeting-notes.md.

## Steps

| Step | What | Owner | State |
|---|---|---|---|
| 1 | Freeze writes to the old store | Ana | done |
| 2 | Copy the records and check their hashes | Bo | in review |
| 3 | Switch reads over, then remove the old store | Cy | blocked |

## Risks

- The copy takes longer than the freeze window.
- A record fails its hash check and has to be copied again.

## Rollback

Reads go back to the old store; nothing written since the switch is lost:

```sh
./scripts/rollback.sh --to old-store
```

> Step 3 waits on the review of step 2.
