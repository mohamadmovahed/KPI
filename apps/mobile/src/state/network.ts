import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkState {
  online: boolean;
}

export const useNetwork = create<NetworkState>(() => ({ online: true }));

/** Subscribe once at app start. `isInternetReachable` can be null while unknown; treat as online. */
export function startNetworkMonitor() {
  return NetInfo.addEventListener((s) => {
    useNetwork.setState({ online: Boolean(s.isConnected) && s.isInternetReachable !== false });
  });
}
