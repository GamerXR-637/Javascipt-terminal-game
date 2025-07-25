const { randomUUID } = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  fg: {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
  },
  bg: {
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
  },
};

const gameState = {
  currentPath: ["/"],
  playerName: "user_" + randomUUID().slice(0, 8),
  unlockedDirs: new Set(),
  unlockedFiles: new Set(),
  subject: randomUUID().slice(0, 5),
};

const fileSystem = {
  "/": {
    "about.txt": () => `
Hello ${gameState.playerName},
\nProject-Injections is a game made by _gamerxr.637_\nGithub: https://github.com/GamerXR-637\nWebsite: https://gamerxr637.is-a.dev/

    `,
  },
};

function getCurrentDirectory() {
  let current = fileSystem;
  for (const part of gameState.currentPath) {
    if (part === "/") {
      current = current["/"];
    } else {
      const nextDir = current[part];
      if (nextDir && nextDir.type === "locked_directory") {
        current =
          typeof nextDir.contents === "function"
            ? nextDir.contents()
            : nextDir.contents;
      } else {
        current = nextDir;
      }
    }
  }
  return current;
}

function getFullPath(filename) {
  const pathString =
    gameState.currentPath.length > 1
      ? gameState.currentPath.join("/").substring(1)
      : "/";
  return `${pathString}/${filename}`;
}

function handleLs() {
  const currentDirectory = getCurrentDirectory();
  const items = Object.keys(currentDirectory);
  if (items.length === 0) {
    console.log("(empty)");
  } else {
    items.forEach((item) => {
      const fileData = currentDirectory[item];
      if (fileData.type === "locked_directory") {
        const isUnlocked =
          gameState.devMode || gameState.unlockedDirs.has(getFullPath(item));
        const lockStatus = isUnlocked
          ? `${colors.fg.green}[UNLOCKED]${colors.reset}`
          : `${colors.fg.red}[LOCKED]${colors.reset}`;
        console.log(
          `drw-r--r--  ${gameState.playerName}  ${colors.fg.blue}${item}/${colors.reset} ${lockStatus}`
        );
      } else if (
        typeof fileData === "object" &&
        fileData.type !== "locked_file"
      ) {
        // If an item is an object but not a locked file, it's a directory.
        console.log(
          `drw-r--r--  ${gameState.playerName}  ${colors.fg.blue}${item}/${colors.reset}`
        );
      } else {
        console.log(`-rw-r--r--  ${gameState.playerName}  ${item}`);
      }
    });
  }
}

function handleCd(args) {
  const target = args[0];
  if (!target) {
    console.log("cd: missing operand");
    return;
  }

  if (target === "..") {
    if (gameState.currentPath.length > 1) {
      gameState.currentPath.pop();
    }
    return;
  }

  const currentDirectory = getCurrentDirectory();
  const targetDir = currentDirectory[target];

  if (!targetDir) {
    console.log(
      `${colors.fg.red}cd: no such directory: ${target}${colors.reset}`
    );
    return;
  }

  if (targetDir.type === "locked_directory") {
    const fullPath = getFullPath(target);
    if (gameState.devMode || gameState.unlockedDirs.has(fullPath)) {
      gameState.currentPath.push(target);
    } else {
      console.log(
        `${colors.fg.yellow}${targetDir.locked_message}${colors.reset}`
      );
      console.log(`Use 'unlock [directory] [password]' to open it.`);
    }
  } else if (
    typeof targetDir === "object" &&
    targetDir.type !== "locked_file"
  ) {
    gameState.currentPath.push(target);
  } else {
    console.log(
      `${colors.fg.red}cd: no such directory: ${target}${colors.reset}`
    );
  }
}

function handleCat(args) {
  const target = args[0];
  if (!target) {
    console.log("cat: missing operand");
    return;
  }
  const currentDirectory = getCurrentDirectory();
  const file = currentDirectory[target];

  if (!file) {
    console.log(`${colors.fg.red}cat: no such file: ${target}${colors.reset}`);
    return;
  }

  if (typeof file === "string") {
    console.log(file);
    return;
  }

  if (typeof file === "function") {
    console.log(file());
    return;
  }

  // Handle locked files
  if (typeof file === "object" && file.type === "locked_file") {
    const fullPath = getFullPath(target);
    if (gameState.devMode || gameState.unlockedFiles.has(fullPath)) {
      if (typeof file.content === "function") {
        console.log(file.content());
      } else {
        console.log(file.content);
      }
    } else {
      console.log(`${colors.fg.yellow}${file.locked_message}${colors.reset}`);
      console.log(`Use 'unlock [filename] [password]' to open it.`);
    }
  } else {
    console.log(`${colors.fg.red}cat: no such file: ${target}${colors.reset}`);
  }
}

function handleUnlock(args) {
  if (gameState.devMode) {
    console.log(
      `${colors.fg.yellow}Dev mode is active. Passwords are not required.${colors.reset}`
    );
    return;
  }

  const [filename, password] = args;
  if (!filename || !password) {
    console.log("Usage: unlock [filename] [password]");
    return;
  }

  const currentDirectory = getCurrentDirectory();
  const item = currentDirectory[filename];

  if (!item) {
    console.log(
      `${colors.fg.red}Cannot unlock '${filename}': No such file or directory.${colors.reset}`
    );
    return;
  }

  if (
    item.type === "locked_file" &&
    password.toLowerCase() === item.password.toLowerCase()
  ) {
    gameState.unlockedFiles.add(getFullPath(filename));
    console.log(
      `${colors.fg.green}Decryption successful. You can now read '${filename}' with the 'cat' command.${colors.reset}`
    );
  } else if (
    item.type === "locked_directory" &&
    password.toLowerCase() === item.password.toLowerCase()
  ) {
    gameState.unlockedDirs.add(getFullPath(filename));
    console.log(
      `${colors.fg.green}Seal broken. You can now access '${filename}/' with the 'cd' command.${colors.reset}`
    );
  } else {
    console.log(
      `${colors.fg.red}Incorrect password or item cannot be unlocked.${colors.reset}`
    );
  }
}

function displayWelcomeBanner() {
  console.log(
    `\nWelcome, ${colors.fg.cyan}${gameState.playerName}${colors.reset} to MicroInject Inc.!\n`
  );
  console.log(
    "Here in MircoInject Inc. we specialize in find way to cure disease with DNA injection therapy."
  );
  const displayDate = new Date();
  displayDate.setFullYear(2023);
  console.log(
    `\n Time: ${new Date().toLocaleTimeString()} \n Date: ${displayDate.toLocaleDateString()}`
  );
  console.log(
    "------------------------------------------------------------------\n"
  );
  console.log("Type 'help' for a list of commands.\n");
}

function handledc(args) {
  const textToDecode = args.join(" ");
  if (!textToDecode) {
    console.log("Usage: dc [text to decode]");
    return;
  }
  try {
    const decoded = Buffer.from(textToDecode, "base64").toString("utf8");
    console.log(`Decoded text: ${decoded}`);
  } catch (e) {
    console.log(
      `${colors.fg.red}Error: Invalid Base64 string provided.${colors.reset}`
    );
  }
}

function handleEc(args) {
  const textToEncode = args.join(" ");
  if (!textToEncode) {
    console.log("Usage: ec [text to encode]");
    return;
  }
  try {
    const encoded = Buffer.from(textToEncode, "utf8").toString("base64");
    console.log(`Encoded text: ${encoded}`);
  } catch (e) {
    console.log(
      `${colors.fg.red}Error: Invalid string provided.${colors.reset}`
    );
  }
}

let alphabet = {
'a': '<',
'b': '!',
'c': '(',
'd': '@',
'e': '%',
'f': '~',
'g': '|',
'h': '?',
'i': '>',
'j': '#',
'k': '$',
'l': '*',
'm': ')',
'n': ';',
'o': '-',
'p': '+',
'q': '=',
'r': '[',
's': ':',
't': ']',
'u': '^',
'v': '&',
'w': '{',
'x': '}',
'y': '.',
'z': "'"
}

// Create a reverse mapping for decoding
const reverseAlphabet = Object.fromEntries(
  Object.entries(alphabet).map(([key, value]) => [value, key])
);

function handleETextCode(args) {
  const textToEncode = args.join(" ");
  if (!textToEncode) {
    console.log("Usage: ec [text to encode]");
    return;
  }
  // First, encode the text to Base64
  const base64Encoded = Buffer.from(textToEncode, "utf8").toString("base64");

  // Then, apply the substitution cipher to the Base64 string
  const finalEncoded = base64Encoded
    .split("")
    .map((char) => alphabet[char] || char)
    .join("");
  console.log(`Encoded text: ${finalEncoded}`);
}

function handleDTextCode(args) {
  const textToDecode = args.join(" ");
  if (!textToDecode) {
    console.log("Usage: dc [text to decode]");
    return;
  }
  // First, reverse the substitution cipher to get the Base64 string
  const base64String = textToDecode
    .split("")
    .map((char) => reverseAlphabet[char] || char)
    .join("");

  // Then, decode the Base64 string back to the original text
  try {
    const decoded = Buffer.from(base64String, "base64").toString("utf8");
    console.log(`Decoded text: ${decoded}`);
  } catch (e) {
    console.log(
      `${colors.fg.red}Error: Invalid input. Could not decode text.${colors.reset}`
    );
  }
}

function handleHelp() {
  console.log("Available commands:");
  console.log("  ls                       - List files and directories.");
  console.log("  cd [dir]                 - Change directory. Use 'cd ..' to go up.");
  console.log("  cat [file]               - Read the contents of a file.");
  console.log("  unlock [name] [password] - Unlock a protected file or directory.");
  console.log("  help                     - Show this help message.");
  console.log("  exit                     - Exit the game.");
  console.log("  clear                    - Clear the console.");
  console.log("  dc64 [text]              - Decode Base64 to text.");
  console.log("  ec64 [text]              - Encode text to Base64.");
  console.log("  dc [text]                - Decode text.");
  console.log("  ec [text]                - Encode text.");
}

function gameLoop() {
  const pathString =
    gameState.currentPath.length > 1
      ? gameState.currentPath.join("/").substring(1)
      : "/";
  const prompt = `${colors.fg.green}${gameState.playerName}@${colors.reset}:${colors.fg.yellow}${pathString}${colors.reset}$ `;

  rl.question(prompt, (input) => {
    const [command, ...args] = input.trim().split(" ");

    switch (command.toLowerCase()) {
      case "ls":
        handleLs();
        break;
      case "cd":
        handleCd(args);
        break;
      case "cat":
        handleCat(args);
        break;
      case "unlock":
        handleUnlock(args);
        break;
      case "help":
        handleHelp();
        break;
      case "dc64":
        handledc(args);
        break;
      case "dc":
        handleDTextCode(args);
        break;
      case "ec64":
        handleEc(args);
        break;
      case "ec":
        handleETextCode(args);
        break;
      case "clear":
        console.clear();
        displayWelcomeBanner();
        break;
      case "exit":
        console.log(`Terminating the game. Goodbye, ${gameState.playerName}!`);
        console.log("Clearing the console...");
        rl.close();
        setTimeout(() => {
          console.clear();
        }, 2000);
        return;
      case "":
        break;
      default:
        console.log(
          `${colors.fg.red}Command not found: ${command}.${colors.reset} Type 'help' for a list of commands.`
        );
    }
    gameLoop();
  });
}

function askForName() {
  rl.question("Please enter a name: ", (name) => {
    if (name.trim()) {
      gameState.playerName = name.trim();
    }
    displayWelcomeBanner();
    gameLoop();
  });
}

function startGame() {
  console.clear();
  askForName();
}

startGame();
