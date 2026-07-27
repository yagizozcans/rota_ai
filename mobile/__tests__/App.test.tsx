/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../src/ui/App';

test('renders correctly', async () => {
  // async act so the permission hook's post-render state update is flushed.
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  // Unmount so App's effect cleanup stops the sync loop (else its timer hangs jest).
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
