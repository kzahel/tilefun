declare module "node-datachannel" {
  export interface PeerConnectionLike {
    onLocalDescription?(handler: (sdp: string, type: "offer" | "answer") => void): void;
    onLocalCandidate?(handler: (candidate: string, sdpMid: string) => void): void;
    onDataChannel?(handler: (dc: DataChannelLike) => void): void;
    onStateChange?(handler: (state: string) => void): void;
    setRemoteDescription?(sdp: string, type: "offer" | "answer"): void;
    addRemoteCandidate?(candidate: string, sdpMid?: string): void;
    close?(): void;
  }

  export interface DataChannelLike {
    onOpen?(handler: () => void): void;
    onClosed?(handler: () => void): void;
    onError?(handler: (err: string) => void): void;
    onMessage?(handler: (data: string | ArrayBuffer | Uint8Array) => void): void;
    sendMessageBinary?(data: Uint8Array): void;
    sendMessage?(data: string | Uint8Array): void;
    close?(): void;
  }

  export interface NodeDataChannelModuleLike {
    initLogger?(level: string): void;
    cleanup?(): void;
    PeerConnection: new (
      name: string,
      config?: {
        iceServers?: readonly string[];
      },
    ) => PeerConnectionLike;
  }

  const nodeDataChannel: NodeDataChannelModuleLike;
  export default nodeDataChannel;
}
