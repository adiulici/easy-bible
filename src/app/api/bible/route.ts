import { NextResponse, NextRequest } from 'next/server'

interface BibleVerse {
  number: string
  text: string
}

interface IBibleBook {
  [key: string]: BibleVerse[]
}

interface IBible {
  [key: string]: IBibleBook
}

import RawBible from '../../../data/bible.json'

// Cast Bible to IBible
const Bible = RawBible as IBible

/**
 * Looks up a book's chapters by name.
 * @param book - Book name as it appears in books.json.
 * @returns The book's chapters, or undefined if no such book exists.
 */
function getBook(book: string): IBibleBook | undefined {
  return Bible[book]
}

/**
 * Handles GET /api/bible?book=<name>, returning that book's chapters.
 * @param request - Incoming request; expects a `book` search param.
 * @returns JSON response with the book's chapters, or a 400/404 error.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const book = searchParams.get('book')

  if (!book) {
    return NextResponse.json({ error: 'Missing book' }, { status: 400 })
  }

  const bookData = getBook(book)
  if (!bookData) {
    return NextResponse.json({ error: `Book not found: ${book}` }, { status: 404 })
  }

  return NextResponse.json(bookData)
}
