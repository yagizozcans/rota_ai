import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { UploadProgress } from '../UploadProgress';
import { useSyncStore } from '../../state/syncStore';

afterEach(() => {
  useSyncStore.setState({ currentUpload: null });
});

async function render() {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<UploadProgress />);
  });
  return r;
}

async function unmount(r: ReactTestRenderer.ReactTestRenderer) {
  // Unmount so the animation loop's cleanup runs; otherwise its RAF fires after
  // the test environment is torn down.
  await ReactTestRenderer.act(async () => {
    r.unmount();
  });
}

test('renders nothing when no upload is in flight', async () => {
  useSyncStore.setState({ currentUpload: null });
  const r = await render();
  expect(r.toJSON()).toBeNull();
  await unmount(r);
});

test('shows the in-flight frame id while uploading', async () => {
  useSyncStore.setState({ currentUpload: { frameId: 'abcdef12-3456-7890-abcd-ef1234567890' } });
  const r = await render();
  const tree = JSON.stringify(r.toJSON());
  expect(tree).toContain('Yükleniyor');
  expect(tree).toContain('abcdef12'); // short id shown
  await unmount(r);
});
