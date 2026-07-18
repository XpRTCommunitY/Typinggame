<img width="1920" height="932" alt="{FE789F0C-0484-435F-8129-4FCE76E81B94}" src="https://github.com/user-attachments/assets/7dd217d8-3dae-4436-ad91-86dd26fb42c7" />
<img width="1916" height="930" alt="{002E7B8B-A03E-41C2-A280-17288A7C1062}" src="https://github.com/user-attachments/assets/1dd5033a-a18e-4817-9541-fcafbae890e0" />
<img width="1920" height="931" alt="{F2DBE0D9-A681-48B3-AA54-0DA4D5E278F8}" src="https://github.com/user-attachments/assets/52e3fc14-0439-4474-b1ce-5f4930a450e1" />

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
