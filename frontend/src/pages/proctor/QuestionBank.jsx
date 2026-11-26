import QuestionBankView from '../../components/QuestionBankView.jsx';

// Proctor question bank: read-only, only the proctor's assigned subjects, public fields only (no answers, no hidden tests).
export default function ProctorQuestionBank() {
  return <QuestionBankView />;
}
