import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { UploadProgress } from '../UploadProgress';
import { useSyncStore } from '../../state/syncStore';

afterEach(() => {
  useSyncStore.setState({ currentUpload: null });
});

test('renders nothing when no upload is in flight', async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<UploadProgress />);
  });
  expect(r.toJSON()).toBeNull();
});

test('shows the in-flight frame id while uploading', async () => {
  useSyncStore.getState().startUpload('abcdef12-3456-7890-abcd-ef1234567890');
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<UploadProgress />);
  });
  const tree = JSON.stringify(r.toJSON());
  expect(tree).toContain('Yükleniyor');
  expect(tree).toContain('abcdef12'); // short id shown
});
