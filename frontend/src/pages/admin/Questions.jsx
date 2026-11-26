import QuestionBankView from '../../components/QuestionBankView.jsx';

// Admin question bank: read-only; answers stay sealed until the admin re-enters their password ("Reveal answers").
export default function Questions() {
  return <QuestionBankView admin />;
}
