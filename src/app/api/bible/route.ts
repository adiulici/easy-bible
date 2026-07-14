import { NextResponse, NextRequest } from 'next/server'
import type { BookContent, Translation } from '@/types/bible'
import VDC from '../../../data/bible.VDC.json'
import NTR from '../../../data/bible.NTR.json'

interface Bible {
  [bookName: string]: BookContent
}

// Static import per translation, selected by the `version` query param. Both
// bundles are block-structured (heading/poetry/paragraph) and keyed by Romanian
// book name -> chapter-number string -> Block[].
const bibles: Record<Translation, Bible> = {
  VDC: VDC as unknown as Bible,
  NTR: NTR as unknown as Bible,
}

const DEFAULT_VERSION: Translation = 'VDC'

/**
 * Narrows an arbitrary string to a supported translation code.
 * @param value - Raw `version` query param (may be null).
 * @returns The matching Translation, or null if unsupported.
 */
function parseVersion(value: string | null): Translation | null {
  if (value === null) {
    return DEFAULT_VERSION
  }
  return value === 'VDC' || value === 'NTR' ? value : null
}

/**
 * Looks up a book's chapters by name within a translation.
 * @param version - Translation code to read from.
 * @param book - Book name as it appears in books.json.
 * @returns The book's chapters (chapter -> blocks), or undefined if absent.
 */
function getBook(version: Translation, book: string): BookContent | undefined {
  return bibles[version][book]
}

/**
 * Handles GET /api/bible?book=<name>&version=<VDC|NTR>, returning that book's
 * block-structured chapters for the requested translation (defaults to VDC).
 * @param request - Incoming request; expects a `book` param and optional `version`.
 * @returns JSON response with the book's chapters, or a 400/404 error.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const book = searchParams.get('book')
  const version = parseVersion(searchParams.get('version'))

  if (!book) {
    return NextResponse.json({ error: 'Missing book' }, { status: 400 })
  }
  if (!version) {
    return NextResponse.json({ error: 'Unknown version' }, { status: 400 })
  }

  const bookData = getBook(version, book)
  if (!bookData) {
    return NextResponse.json({ error: `Book not found: ${book}` }, { status: 404 })
  }

  return NextResponse.json(bookData)
}
