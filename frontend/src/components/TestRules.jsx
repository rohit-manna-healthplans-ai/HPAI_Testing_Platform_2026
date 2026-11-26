/** The rules every candidate must accept before starting (shared by the Home instructions modal and the invite page). */
export default function TestRules() {
  return (
    <ul className="rules">
      <li>The test can be <b>started only once</b>. Closing or reloading the page does not restart it or reset the timer.</li>
      <li>The test runs in <b>fullscreen</b>. You may leave the test screen (switch tab / window or exit fullscreen) <b>at most 2 times</b>. You get a warning each time, and on the <b>3rd time your test is submitted automatically</b>.</li>
      <li><b>Screenshots, screen recording, printing and copying questions are strictly prohibited.</b> The page is watermarked with your identity, content is hidden whenever you leave the window, and any attempt is recorded and reported to your proctor.</li>
      <li><b>Tab switches, window changes and copy/paste</b> are monitored and reported to your proctor. Violations may lead to disqualification.</li>
      <li>Your answers autosave. If you lose connection, keep working and reconnect — you can resume.</li>
      <li>Code is run and marked in your browser; partial marks are given for passing test cases.</li>
      <li>The test auto-submits when time runs out. You will see only your marks afterwards.</li>
    </ul>
  );
}
