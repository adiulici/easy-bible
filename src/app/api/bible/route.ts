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

function getBook(book: string) {
  return Bible[book]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const book = searchParams.get('book')

  if (!book) {
    return NextResponse.json({ error: 'Missing book' })
  }

  return NextResponse.json(getBook(book))
}
