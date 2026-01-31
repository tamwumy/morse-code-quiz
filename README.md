# Morse Code Quiz

A sleek, terminal-themed web application designed to help you master Morse code. Built with React and Tailwind CSS, this app offers an interactive way to practice encoding and decoding Morse code with realistic audio feedback.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Multiple Game Modes**:
  - **English → Morse**: Translate English words into Morse code.
  - **Morse → English**: Decode Morse patterns back into English.
  - **Mixed Mode**: Randomly switch between both for a balanced challenge.
- **Realistic Audio**: Integrated Web Audio API "Telegraph" sound engine that generates realistic beeps not just generic sine waves.
- **Reference Chart**: Built-in Morse code cheat sheet for learning on the fly.
- **Progress Tracking**: Real-time stats for accuracy, total questions, and streaks.
- **Customizable**: Toggle sound on/off and choose whether to include digits in the quiz.
- **Responsive Design**: Looks great on desktop and mobile with a dark, hacker-style aesthetic.

## Tech Stack

- **Framework**: [React](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: GitHub Pages

## Getting Started

### Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tamwumy/morse-code-quiz.git
   cd morse-code-quiz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Usage

- **Type your answer** in the input available.
- Press **Enter** to check your answer.
- Press **Shift + Enter** to skip to the next question.
- Use the **Play** button to hear the Morse code sequence.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the information MIT License.