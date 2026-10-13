import { referenceRanges } from "../../supabase/functions/ask-lotti/reference";

describe("Frag Lotti reference ranges", () => {
  it("anchors a sleep question in the range for that age", () => {
    const [range] = referenceRanges(["sleep"], 14, "de");
    expect(range.label).toContain("14 Monaten");
    expect(range.detail).toBe("11–14 Std. pro 24 Std., davon 1-2 Nickerchen");
  });

  it.each([
    [2, "14–17"],
    [6, "12–15"],
    [11, "12–15"],
    [14, "11–14"],
    [30, "11–14"],
    [48, "10–13"],
    [96, "9–12"],
  ])("covers age %i months with range %s", (months, expected) => {
    const [range] = referenceRanges(["sleep"], months, "de");
    expect(range.detail).toContain(expected);
  });

  it("localizes the range", () => {
    expect(referenceRanges(["sleep"], 14, "en")[0].detail).toBe(
      "11–14 h per 24 h, including 1-2 naps",
    );
    expect(referenceRanges(["sleep"], 14, "es")[0].detail).toBe(
      "11–14 h por 24 h, con 1-2 siestas",
    );
  });

  it("stays silent without an age or an unrelated domain", () => {
    expect(referenceRanges(["sleep"], null, "de")).toEqual([]);
    expect(referenceRanges(["growth", "feeding"], 14, "de")).toEqual([]);
    expect(referenceRanges(["sleep"], -1, "de")).toEqual([]);
  });

  it("gives a newborn a range rather than falling through", () => {
    expect(referenceRanges(["sleep"], 0, "de")[0].detail).toContain("14–17");
  });
});
