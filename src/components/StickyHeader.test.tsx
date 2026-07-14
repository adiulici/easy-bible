import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import StickyHeader from "@/components/StickyHeader";

afterEach(() => {
  cleanup();
});

describe("StickyHeader", () => {
  it("renders the book name and translation code", () => {
    render(
      <StickyHeader
        bookName="Ioan"
        translationCode="VDC"
        translationLabel="Versiunea Dumitru Cornilescu"
        visible={false}
      />
    );
    expect(screen.getByText("Ioan")).toBeInTheDocument();
    expect(screen.getByText("VDC")).toBeInTheDocument();
  });

  it("uses the translation label as a tooltip", () => {
    render(
      <StickyHeader
        bookName="Ioan"
        translationCode="VDC"
        translationLabel="Versiunea Dumitru Cornilescu"
        visible={false}
      />
    );
    expect(screen.getByText("VDC")).toHaveAttribute("title", "Versiunea Dumitru Cornilescu");
  });

  it("does not apply the visible class when visible=false", () => {
    const { container } = render(
      <StickyHeader
        bookName="Ioan"
        translationCode="VDC"
        translationLabel="Versiunea Dumitru Cornilescu"
        visible={false}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/visible/);
  });

  it("applies the visible class when visible=true", () => {
    const { container } = render(
      <StickyHeader
        bookName="Ioan"
        translationCode="VDC"
        translationLabel="Versiunea Dumitru Cornilescu"
        visible={true}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/visible/);
  });
});
