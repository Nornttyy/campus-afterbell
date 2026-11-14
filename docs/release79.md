# Campus 79 — browser-hosted rooms and ordinary classroom

## Implemented

- Player UI: create/join, nickname, six-digit code, owner parameters. Removed the server URL field. GitHub Pages can run the client without renting a Node host.
- Authoritative simulation reused in a dedicated Web Worker. Reliable binary RTC data channels, personalized delta snapshots at 15 Hz, complete snapshots every two seconds, command validation and room-scoped voice signaling. Existing Node tests exercise the same simulation.
- Local ordinary classroom: three double-desk columns balanced around the classroom; ceiling and hanging lamps lowered 0.38 m; larger terrazzo granules. Daylight sun increased from 3.8 to 4.6, ambient from 2.55 to 2.25; warmer sun and neutral floor bounce. Night profile unchanged.
- Seated student chest lift 0.05 m with forward bend, keeping the existing pelvis and chair position. Existing support IK maintains fingers/book, pen/page and feet/floor contact. Walking shoulder swing reduced and elbow bend increased; excessive extra arm abduction reduced per model.
- User-authored six first-person clips, character source GLBs and faces unchanged.

## Verified, 2026-11-14

- Full suite: 1085 tests passed, zero failed, zero skipped.
- Real browser direct connection using public signaling: host and guest joined, guest movement synchronized, host selected teacher, both entered preparation/class, host leaving ended the guest session.
- Formal game menu: two browsers, 4-player limit, 7-minute round and 80-point goal; both displayed room 232037, 2/4 players, identical class timer and score goal. No server URL was entered.
- Critical defect found during this test: JSON serialization exceeded the browser data-channel message size for complete snapshots. Switched PeerJS to binary serialization with automatic fragmentation, then repeated create/join/play successfully.
- Classroom route: remaining waypoints 0, blocked steps 0. Rendered front and oblique views compared with locally retained reference footage/stills.
- Targeted geometric pose checks: 36 passed, including book/finger, page/pen, foot/floor and walking arm clearance.

## Limitations

This is not a dedicated always-on room service. Public signaling and STUN are still external services. Some NATs require TURN, which is not configured. Host exit/refresh ends the room; keep the host page active. No host migration or persisted room. Eight physical-device/cross-network and microphone listening tests were not performed. Browser testing was on two pages on one machine.

Reference classroom colour, character topology and animations still differ from the commercial original; no claim of exact reconstruction or user approval. Original reference files remain local and are not deployed. Screenshots of the iteration are in local art-source/release79/.

## References

- PeerJS: https://peerjs.com/client/getting-started and https://peerjs.com/client/faq
- PeerServer public signaling: https://peerjs.com/server/getting-started
- Original footage supplied by user: https://www.bilibili.com/video/BV13L476gE1o/
- Additional original screenshots: Steam app 5175310, locally retained docs/reference-media/steam-03.jpg etc.
