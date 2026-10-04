# Semantic mapping investigation packets

The coordinator creates bounded assignments from the [queue](../queue.md) using
the [packet template](../packet-template.md).
Name each file `PACKET_ID-short-name.md` and give each worker an explicit output
path. Keep review artifacts separate when two workers contribute to one packet;
the coordinator reconciles them after both have finished.

Link durable evidence and related dated notes from the packet. Exact source
hashes and coordinates must accompany interpretations so another session can
reproduce the investigation.

## Whole-sheet reconnaissance

| Packet | Source scope | Current disposition |
| --- | --- | --- |
| [S02 Exteriors](S02-exteriors-survey.md) · [regions](S02-exteriors-regions.json) | Full 2816×8224 master, including lower extensions | 45 broad theme windows and 40 bounded residual windows; independent review pending |
| [S02 Interiors](S02-interiors-survey.md) · [regions](S02-interiors-regions.json) | Full 256×17024 Interiors and 1216×1808 Room Builder masters | 45 navigation bands, six furniture search windows, 12 architecture windows and five caption windows; independent review pending |

These are navigational hypotheses, not completed object segmentation. Region
coverage and source-pixel accounting do not measure semantic accuracy or approval.
The queue tracks tree, scrapyard and cabinet trials separately.
