import { QuestionCard, QuestionCardAudio, QuestionCardPhoto, QuestionCardText, QuestionCardWhoLikely } from "../../../components/questions";
import type { AnswerType } from "../../../types";
import type { PackInfo, ResponseData } from "../types";

interface SwipeQuestionCardProps {
    question: any;
    packInfo: PackInfo | null;
    user: { id: string; name?: string | null; avatar_url?: string | null } | null;
    partner: { id: string; name?: string | null; avatar_url?: string | null } | null;
    onAnswer: (questionId: string, answer: AnswerType | 'skip', responseData?: ResponseData) => void;
    onReport: (questionId: string, questionText: string) => void;
}

export const SwipeQuestionCard = ({
    question,
    packInfo,
    user,
    partner,
    onAnswer,
    onReport,
}: SwipeQuestionCardProps) => {
    const questionType = question.question_type || 'swipe';
    const handleReport = () => onReport(question.id, question.text);

    switch (questionType) {
        case 'text_answer':
            return (
                <QuestionCardText
                    key={question.id}
                    question={question}
                    packInfo={packInfo}
                    onAnswer={(answer, responseData) => onAnswer(question.id, answer, responseData)}
                    onReport={handleReport}
                />
            );
        case 'photo':
            return (
                <QuestionCardPhoto
                    key={question.id}
                    question={question}
                    packInfo={packInfo}
                    onAnswer={(answer, responseData) => onAnswer(question.id, answer, responseData)}
                    onReport={handleReport}
                />
            );
        case 'audio':
            return (
                <QuestionCardAudio
                    key={question.id}
                    question={question}
                    packInfo={packInfo}
                    onAnswer={(answer, responseData) => onAnswer(question.id, answer, responseData)}
                    onReport={handleReport}
                />
            );
        case 'who_likely':
            return (
                <QuestionCardWhoLikely
                    key={question.id}
                    question={question}
                    packInfo={packInfo}
                    user={{ id: user?.id || '', name: user?.name || undefined, avatar_url: user?.avatar_url }}
                    partner={{ id: partner?.id || '', name: partner?.name || undefined, avatar_url: partner?.avatar_url }}
                    onAnswer={(responseData) => onAnswer(question.id, 'yes', responseData)}
                    onSkip={() => onAnswer(question.id, 'skip')}
                    onReport={handleReport}
                />
            );
        case 'swipe':
        default:
            return (
                <QuestionCard
                    key={question.id}
                    question={question}
                    packInfo={packInfo}
                    onAnswer={(answer) => onAnswer(question.id, answer)}
                    onReport={handleReport}
                />
            );
    }
};
