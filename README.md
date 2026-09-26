# OnShare

## About
OnShare is a browser-to-browser data transmission and real-time text collaboration tool. It connects users securely via WebRTC without using server-side file hosting or user accounts. All data is transmitted directly between peers.

## Features
- Direct peer-to-peer file transfers via WebRTC data channels.
- Real-time collaborative text editing using Yjs CRDTs.
- Receiver-generated 6-digit ephemeral access codes.
- Zero-storage, ephemeral WebSocket-based signaling coordination.
- Live streaming and archiving of multiple files into a single ZIP via `fflate`.
- Internationalization (i18n) support for over 25 languages.

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
- Vitest (Unit testing)
- Playwright (End-to-End testing)
- ESLint (Linting)

## Folder Structure
- `apps/` - Contains the main frontend React web application and backend WebSocket signaling server.
- `docs/` - Project documentation, product requirements, and technical specifications.
- `packages/` - Shared libraries, protocols, and internal tooling used across apps.
- `tests/` - Playwright end-to-end tests for critical user flows.

## Local Setup

**Prerequisites:** Node.js v18 or newer.

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd SharePort
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the backend signaling server:**
   ```bash
   npm run dev:signaling
   ```
   *(The signaling server runs in the background to broker peer connections)*

4. **Start the frontend web application:**
   *(In a new terminal window)*
   ```bash
   npm run dev:web
   ```
   *(The app will be accessible at http://localhost:5173)*
