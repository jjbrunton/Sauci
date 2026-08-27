import type { AnswerType, QuestionType } from '@sauci/shared';
import { Badge } from '@/components/ui/badge';
import { formatAdminResponse, QUESTION_TYPE_LABELS, type AdminResponseData } from '@/lib/questionResponses';

interface ResponseAnswerProps {
    answer: AnswerType;
    questionType?: QuestionType | null;
    responseData?: AdminResponseData;
}

export function ResponseAnswer({ answer, questionType, responseData = null }: ResponseAnswerProps) {
    const formatted = formatAdminResponse(questionType, answer, responseData);
    const resolvedType = questionType ?? 'swipe';

    return (
        <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{formatted.label}</span>
                {resolvedType !== 'swipe' && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                        {QUESTION_TYPE_LABELS[resolvedType]}
                    </Badge>
                )}
            </div>
            {formatted.detail && (
                <p className="max-w-md whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {formatted.detail}
                </p>
            )}
        </div>
    );
}
