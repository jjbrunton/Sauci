import { render } from "@/test/test-utils";
import { QuizResultsShareCard } from "./QuizResultsShareCard";

describe("QuizResultsShareCard", () => {
    it("renders the score and Sauci watermark without any question content", () => {
        const { getByText, queryByText } = render(
            <QuizResultsShareCard scorePercent={84} cardWidth={300} />,
        );

        expect(getByText("84%")).toBeTruthy();
        expect(getByText("How well do you know each other?")).toBeTruthy();
        expect(getByText("sauci.app")).toBeTruthy();
        expect(queryByText(/prompt/i)).toBeNull();
    });
});
