export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "rating"
  | "slide"
  | "free_response"
  | "word_cloud"
  | "poll"
  | "ranking";

export type SessionState =
  | "waiting"
  | "question_active"
  | "showing_results"
  | "ended";

export type DesignSettings = {
  /** Brand primary color (hex). Falls back to the default violet. */
  primary?: string;
  /** Brand secondary color (hex). Falls back to the default pink. */
  secondary?: string;
};

export type Quiz = {
  id: string;
  title: string;
  design_settings: DesignSettings;
  created_at: string;
};

export type Question = {
  id: string;
  quiz_id: string;
  question_text: string;
  type: QuestionType;
  position: number;
  time_limit: number | null;
  image_url: string | null;
  created_at: string;
};

export type AnswerOption = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number;
  image_url: string | null;
  created_at: string;
};

export type GameSession = {
  id: string;
  quiz_id: string;
  join_code: string;
  state: SessionState;
  current_question_id: string | null;
  created_at: string;
};

export type Participant = {
  id: string;
  session_id: string;
  nickname: string;
  joined_at: string;
};

export type ResponseRow = {
  id: string;
  session_id: string;
  participant_id: string;
  question_id: string;
  answer_data: { option_id?: string; text?: string };
  submitted_at: string;
};
