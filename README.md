# XpRT Community - Multiplayer Keyboard Battle ⚔️⌨️

A real-time, fast-paced multiplayer typing game where two players can battle each other by typing words quickly and accurately. Built with Node.js and Socket.io, this game turns standard typing tests into an epic stickman combat arena!

## 🌟 Key Features

*   **Real-time 1v1 Multiplayer:** Create a custom room, share the code, and **two people can play together** simultaneously! Battle your friends to see who is the fastest typist.
*   **Single Player Mode:** No opponent? No problem! Practice your typing skills by fighting against an intelligent AI bot.
*   **Dynamic Visual Combat:** Every keystroke counts! Correctly typing words triggers awesome stickman fighting animations, sparks, and blood splatters on screen.
*   **Multiple Difficulties:** Choose your challenge level:
    *   *Easy:* Short, lowercase words.
    *   *Medium:* Capitalized and moderately long words.
    *   *Hard:* Long, mixed-case words.
    *   *Impossible:* Complex phrases and symbols.
*   **Custom Time Limits:** Play quick 1-minute matches or marathon 15-minute battles.
*   **Combo System:** String together perfect words without mistakes to build a combo multiplier and deal massive damage to your opponent.
*   **Vibration & Sound Effects:** Immersive hit sounds and visual feedback (can be toggled on/off).

## 🚀 Technologies Used

*   **Frontend:** HTML5, Vanilla CSS (Custom styling, animations, and responsive layout), Vanilla JavaScript.
*   **Backend:** Node.js, Express.js.
*   **Real-time Communication:** Socket.io for instant multiplayer synchronization.
*   **External API:** Random Word API for fetching an endless supply of varied vocabulary.

## 💻 How to Run Locally

1.  **Prerequisites:** Make sure you have [Node.js](https://nodejs.org/) installed on your computer.
2.  **Install Dependencies:** Open your terminal in the project folder and run:
    ```bash
    npm install
    ```
    *(Note: Ensure you have `express` and `socket.io` installed)*
3.  **Start the Server:**
    ```bash
    node server.js
    ```
4.  **Play the Game:** Open your web browser and go to `http://localhost:3000`. To play with a friend on the same Wi-Fi network, they can join using your computer's local IP address (e.g., `http://192.168.x.x:3000`).

---
*Created for the XpRT Community.*
