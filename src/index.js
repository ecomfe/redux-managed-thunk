/**
 * redux-managed-thunk
 *
 * @file entry point
 * @author otakustay
 */

import thunk from './thunk';
export default thunk;

export {default as optimisticEnhancer} from './optimistic';

export * from './dispatch';
export * from './consumer';
export * from './hotc';
