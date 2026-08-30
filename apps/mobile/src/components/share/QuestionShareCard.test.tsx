import { render } from "@/test/test-utils";
import { QuestionShareCard } from "./QuestionShareCard";

describe("QuestionShareCard", () => {
    it("renders the question, pack badge, and Sauci branding", () => {
        const { getByText } = render(
            <QuestionShareCard
                question={{ text: "What's your idea of a perfect date night?" }}
                packName="Date Night"
                cardWidth={300}
            />,
        );

        expect(getByText("What's your idea of a perfect date night?")).toBeTruthy();
        expect(getByText("Date Night")).toBeTruthy();
        expect(getByText("Sauci")).toBeTruthy();
        expect(getByText("sauci.app")).toBeTruthy();
        expect(getByText(/play it with your partner/i)).toBeTruthy();
    });

    it("never renders a couple join link — the pairing code is private", () => {
        const { queryByText } = render(
            <QuestionShareCard question={{ text: "A question" }} cardWidth={300} />,
        );

        expect(queryByText(/join\//)).toBeNull();
    });
});
