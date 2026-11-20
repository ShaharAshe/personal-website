// npm run test:e2e:linux:clean (Task 2.20): removes this project's e2e image(s) and its Linux node_modules volume,
// and nothing else. The next npm run test:e2e:linux rebuilds both.
//
// Usage: npm run test:e2e:linux:clean

import { docker, requireDocker } from './docker-cli.ts';
import { IMAGE_REPO, VOLUME, listTagsArgs, projectImages, removeImagesArgs, removeVolumeArgs } from './docker.ts';

requireDocker();

let failed = false;

const images = projectImages(docker(listTagsArgs, { quiet: true }).stdout);
if (images.length === 0) {
  console.log(`No ${IMAGE_REPO} image to remove.`);
} else if (docker(removeImagesArgs(images)).status !== 0) {
  failed = true;
}

if (docker(['volume', 'inspect', VOLUME], { quiet: true }).status !== 0) {
  console.log(`No ${VOLUME} volume to remove.`);
} else if (docker(removeVolumeArgs).status === 0) {
  console.log(`Removed volume ${VOLUME}.`);
} else {
  failed = true;
}

process.exit(failed ? 1 : 0);
