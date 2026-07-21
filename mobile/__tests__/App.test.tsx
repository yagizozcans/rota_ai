/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../src/ui/App';

test('renders correctly', async () => {
  // async act so the permission hook's post-render state update is flushed.
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});
