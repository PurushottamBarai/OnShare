# OnShare

## About
OnShare is a browser-to-browser data transmission and real-time text collaboration tool. It connects users securely via WebRTC without using server-side file hosting or user accounts. All data is transmitted directly between peers.

## Features
- Direct peer-to-peer file transfers via WebRTC data channels.
- Real-time collaborative text editing using Yjs CRDTs.
- Receiver-generated 6-digit ephemeral access codes.
- Zero-storage, ephemeral WebSocket-based signaling coordination.
- Live streaming and archiving of multiple files into a single ZIP via `fflate`.
- Internationalization (i18n) support for over 30 languages.

## Tech Stack
**Frontend:**
- React (UI library)
- Vite (Build tool)
- Tailwind CSS (Styling)
- React Router (Client-side routing)
- i18next (Internationalization)
- Yjs (CRDT text synchronization)
- fflate (In-browser ZIP streaming)

**Backend / Signaling:**
- Node.js / Cloudflare Workers
- WebSockets
- WebRTC (RTCPeerConnection / RTCDataChannel)

**Testing / Tooling:**
- Vitest (Unit & integration testing)
- Playwright (End-to-End testing)
- ESLint (Linting)

## Folder Structure
- `apps/` - Contains the main frontend React web application (`apps/web`) and backend signaling server (`apps/signaling`).
- `packages/` - Shared libraries, protocols, and internal tooling used across apps (`packages/protocol`).
- `tests/` - Playwright end-to-end tests for critical user flows.

## Local Setup

**Prerequisites:** Node.js v18 or newer.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PurushottamBarai/OnShare.git
   cd OnShare
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the backend signaling server:**
   
   **Option A: Standalone Node (Fastest & simplest for local dev):**
   ```bash
   node apps/signaling/src/server.js
   ```

   **Option B: Cloudflare Workers emulation via Wrangler:**
   ```bash
   npm run dev:signaling
   ```
   *(The signaling server runs on `http://127.0.0.1:8787` to broker peer connections)*

4. **Start the frontend web application:**
   *(In a new terminal window)*
   ```bash
   npm run dev:web
   ```
   *(The app will be accessible at `http://localhost:3000` or `http://localhost:5173`)*

## Testing & Quality

- **Run all unit & integration tests:**
  ```bash
  npm test
  ```
- **Run end-to-end Playwright tests:**
  ```bash
  npm run test:e2e
  ```
- **Lint code:**
  ```bash
  npm run lint
  ```
