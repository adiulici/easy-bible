"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

function smoothScrollToChapter(chapterNumber: string) {
  window.scrollTo({
    top: (document.getElementById(`chapter-${chapterNumber}`)?.offsetTop ?? 0) - 30,
    behavior: 'smooth'
  });
}

function Chapter({ chapter }: { chapter: { number: number; text: string }[] }) {
  return (
    <>
      {chapter.map((data) => (
        <span
          key={data.number}
          dangerouslySetInnerHTML={{ __html: `${data.text} ` }}
        ></span>
      ))}
    </>
  );
}

function Book({
  book,
}: {
  book: { [key: string]: { number: number; text: string }[] };
}) {
  return (
    <>
      {Object.values(book).map((chapter, index) => (
        <p key={index} id={`chapter-${index + 1}`}>
          <span className={styles.chapter}>{index + 1}.</span>
          <Chapter chapter={chapter} />
        </p>
      ))}
    </>
  );
}

export default function Home() {
  const [content, setContent] = useState<{
    [key: string]: { number: number; text: string }[];
  }>({});
  const book = "Matei";
  const isChapterMode = useRef(false);
  const chapterNumber = useRef('');
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // If "g" is pressed, enter in "go to chapter" mode
      // The next keys pressed will be the chapter number
      // And then the user presses enter to go to the chapter
      // If any other key than a number or enter is pressed, exit the mode
      if (event.key === 'g') {
        isChapterMode.current = true;
        return;
      }

      if (isChapterMode.current) {
        // If the key is a number, add it to the chapter number
        if (event.key.match(/^\d$/)) {
          chapterNumber.current += event.key;
          return;
        }

        // If the key is enter, go to the chapter
        if (event.key === 'Enter') {
          isChapterMode.current = false;
          smoothScrollToChapter(chapterNumber.current);
          chapterNumber.current = ''
        }

        // If any other key is pressed, exit the mode
        isChapterMode.current = false;
        chapterNumber.current = '';

        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  useEffect(() => {
    fetch("/api/bible?book=" + book)
      .then((response) => response.json())
      .then((data) => {
        setContent(data);
      });
  }, [book]);

  return (
    <div className={styles.container}>
      <h1>{book}</h1>
      <div className={styles.content}>
        <Book book={content} />
      </div>
    </div>
  );
}
