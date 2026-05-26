export interface ParsedAgentQuestion {
  question: string;
  choices: string[];
  rawText: string;
}

const choiceLinePattern = /^(?:[-*]\s+|\d+[\).:-]\s*|\[[ x]?\]\s*|\([a-z]\)\s*|[a-z][\).:-]\s*)(.{2,180})$/i;
const questionCuePattern = /\?|choose|choice|select|option|which|would you like|do you want|please pick/i;

export const parseAgentChoiceQuestion = (text: string): ParsedAgentQuestion | undefined => {
  const lines = text
    .slice(-4000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const choices: string[] = [];
    let startIndex = index;

    for (let cursor = index; cursor >= 0; cursor -= 1) {
      const match = lines[cursor].match(choiceLinePattern);
      if (!match) {
        if (choices.length > 0) {
          break;
        }
        continue;
      }
      choices.unshift(match[1].trim());
      startIndex = cursor;
    }

    if (choices.length < 2) {
      continue;
    }

    const questionCandidates = lines.slice(Math.max(0, startIndex - 5), startIndex).filter((line) => !choiceLinePattern.test(line));
    const question =
      questionCandidates
        .slice()
        .reverse()
        .find((line) => questionCuePattern.test(line)) ?? questionCandidates.at(-1);

    if (!question) {
      continue;
    }

    return {
      question,
      choices,
      rawText: [...questionCandidates.slice(-2), ...choices.map((choice, choiceIndex) => `${choiceIndex + 1}. ${choice}`)].join("\n")
    };
  }

  return undefined;
};
