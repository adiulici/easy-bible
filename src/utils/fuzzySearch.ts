/**
 * Fuzzy search utility for matching book names
 * Simple algorithm: checks if all characters of input appear in book name in order
 * Prioritizes matches that start with the input
 */

export function fuzzyMatch(input: string, bookName: string): boolean {
  const normalizedInput = input.toLowerCase().trim();
  const normalizedBook = bookName.toLowerCase();

  if (normalizedInput === "") {
    return true;
  }

  // Check if book name starts with input (highest priority)
  if (normalizedBook.startsWith(normalizedInput)) {
    return true;
  }

  // Check if all characters of input appear in book name in order
  let inputIndex = 0;
  for (let i = 0; i < normalizedBook.length && inputIndex < normalizedInput.length; i++) {
    if (normalizedBook[i] === normalizedInput[inputIndex]) {
      inputIndex++;
    }
  }

  return inputIndex === normalizedInput.length;
}

export function findBestMatch(input: string, books: string[]): string | null {
  const normalizedInput = input.toLowerCase().trim();

  if (normalizedInput === "") {
    return null;
  }

  // First, try to find exact match
  const exactMatch = books.find(
    (book) => book.toLowerCase() === normalizedInput
  );
  if (exactMatch) {
    return exactMatch;
  }

  // Then, try to find matches that start with input
  const startsWithMatch = books.find((book) =>
    book.toLowerCase().startsWith(normalizedInput)
  );
  if (startsWithMatch) {
    return startsWithMatch;
  }

  // Finally, try fuzzy match
  const fuzzyMatches = books.filter((book) => fuzzyMatch(input, book));
  if (fuzzyMatches.length > 0) {
    return fuzzyMatches[0];
  }

  return null;
}
