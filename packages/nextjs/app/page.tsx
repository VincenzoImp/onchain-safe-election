"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract("YourContract");

  // Client-side only state
  const [isClient, setIsClient] = useState(false);

  // Form state
  const [voteData, setVoteData] = useState("");
  const [newUniversityAddress, setNewUniversityAddress] = useState("");
  const [newUniversityName, setNewUniversityName] = useState("");
  const [removeUniversityAddress, setRemoveUniversityAddress] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" }>({
    message: "",
    type: "success",
  });

  // Ensure client-side only rendering for Web3 components
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Contract reads - only after client-side hydration
  const { data: VOTE_STATUS } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "VOTE_STATUS",
    watch: true,
  });

  const { data: currentPresident } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "currentPresident",
    watch: true,
  });

  const { data: votesNumber } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "votesNumber",
    watch: true,
  });

  const { data: univNumber } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "univNumber",
    watch: true,
  });

  const { data: electionEndBlock } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "electionEndBlock",
    watch: true,
  });

  const { data: currentBlock } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getCurrentBlock",
    watch: true,
  });

  const { data: universitiesData } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getAllUniversitiesWithNames",
    watch: true,
  });

  const { data: hasVotedData } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "hasVoted",
    args: [connectedAddress],
    watch: true,
  });

  const { data: isUniversityData } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "isUniversity",
    args: [connectedAddress],
    watch: true,
  });

  const { data: universityAddress } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getProfessorInfo",
    args: [connectedAddress],
    watch: true,
  });

  const { data: winner } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "WINNER",
    watch: true,
  });

  const { data: heldFeeInfo } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getHeldFeeInfo",
    watch: true,
  });

  // Don't render Web3 components until client-side
  if (!isClient) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4">Loading application...</p>
        </div>
      </div>
    );
  }

  // Derived state
  const hasVoted = hasVotedData ?? false;
  const isUniversity = isUniversityData ?? false;
  const isCurrentPresident = connectedAddress === currentPresident;
  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const universities = universitiesData
    ? universitiesData[0].map((addr: string, index: number) => ({
        address: addr,
        name: universitiesData[1][index] || addr,
      }))
    : [];

  const statusNames = ["No Election", "In Progress", "Closed"];
  const statusColors = ["bg-gray-500", "bg-blue-500", "bg-green-500"];

  // Utility functions
  const validateVoteData = (data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        Object.values(parsed).every(val => typeof val === "number" && Number(val) >= 0)
      );
    } catch {
      return false;
    }
  };

  const handleTransaction = async (transactionFn: () => Promise<any>, action: string) => {
    setLoading(action);
    try {
      await transactionFn();
      setNotification({ message: `${action} successful!`, type: "success" });
    } catch (error: any) {
      console.error(`${action} failed:`, error);
      const errorMessage = error?.shortMessage || error?.message || "Transaction failed";
      setNotification({ message: `${action} failed: ${errorMessage}`, type: "error" });
    } finally {
      setLoading(null);
      setTimeout(() => setNotification({ message: "", type: "success" }), 5000);
    }
  };

  // Component functions
  const NotificationBanner = () => {
    if (!notification.message) return null;

    return (
      <div className={`alert ${notification.type === "success" ? "alert-success" : "alert-error"} mb-6`}>
        <span>{notification.message}</span>
      </div>
    );
  };

  const ElectionStatusCard = () => (
    <div className="card bg-base-100 shadow-xl mb-6">
      <div className="card-body">
        <h2 className="card-title flex items-center">
          <div
            className={`w-3 h-3 rounded-full ${statusColors[typeof VOTE_STATUS === "number" ? VOTE_STATUS : 0]}`}
          ></div>
          Election Status: {statusNames[typeof VOTE_STATUS === "number" ? VOTE_STATUS : 0]}
        </h2>

        {currentPresident && currentPresident !== zeroAddress && (
          <div className="alert alert-info">
            <span className="font-bold">
              Current President: {currentPresident.slice(0, 8)}...{currentPresident.slice(-6)}
              {isCurrentPresident && " (You)"}
            </span>
          </div>
        )}

        {(!currentPresident || currentPresident === zeroAddress) && (
          <div className="alert alert-warning">
            <span>No president elected yet. Elect one through an election!</span>
          </div>
        )}

        {VOTE_STATUS === 1 && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Votes: {votesNumber?.toString()}/{univNumber?.toString()}
              </span>
              <span>
                Blocks remaining:{" "}
                {electionEndBlock && currentBlock
                  ? Math.max(0, Number(electionEndBlock) - Number(currentBlock)).toString()
                  : "Loading..."}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={Number(votesNumber)}
              max={Number(univNumber)}
            ></progress>
          </div>
        )}

        {heldFeeInfo && heldFeeInfo[0] > 0 && (
          <div className="alert alert-warning">
            <span>Election fee held: {heldFeeInfo[0].toString()} wei (will be returned after election)</span>
          </div>
        )}

        {winner && winner !== "" && (
          <div className="alert alert-success">
            <span className="font-bold">Last Winner: {winner}</span>
          </div>
        )}
      </div>
    </div>
  );

  const PresidentManagementCard = () => {
    if (!isCurrentPresident || !currentPresident || currentPresident === zeroAddress) return null;

    return (
      <div className="card bg-secondary text-secondary-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">👑 President Management</h2>
          <p className="text-sm">As the current president, you can add or remove universities.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add University */}
            <div className="space-y-3">
              <h3 className="font-semibold">Add University</h3>
              <input
                type="text"
                placeholder="University Address (0x...)"
                className="input input-bordered w-full text-base-content"
                value={newUniversityAddress}
                onChange={e => setNewUniversityAddress(e.target.value)}
                disabled={VOTE_STATUS !== 0}
              />
              <input
                type="text"
                placeholder="University Name"
                className="input input-bordered w-full text-base-content"
                value={newUniversityName}
                onChange={e => setNewUniversityName(e.target.value)}
                disabled={VOTE_STATUS !== 0}
              />
              <button
                className="btn btn-primary w-full"
                disabled={!newUniversityAddress || !newUniversityName || loading === "adding" || VOTE_STATUS !== 0}
                onClick={() =>
                  handleTransaction(async () => {
                    if (!writeYourContractAsync) throw new Error("Contract not ready");
                    await writeYourContractAsync({
                      functionName: "addUniversity",
                      args: [newUniversityAddress, newUniversityName],
                    });
                    setNewUniversityAddress("");
                    setNewUniversityName("");
                  }, "Adding university")
                }
              >
                {loading === "adding" ? "Adding..." : "Add University"}
              </button>
            </div>

            {/* Remove University */}
            <div className="space-y-3">
              <h3 className="font-semibold">Remove University</h3>
              <select
                className="select select-bordered w-full text-base-content"
                value={removeUniversityAddress}
                onChange={e => setRemoveUniversityAddress(e.target.value)}
                disabled={VOTE_STATUS !== 0}
              >
                <option value="">Select University to Remove</option>
                {universities.map(uni => (
                  <option key={uni.address} value={uni.address}>
                    {uni.name} ({uni.address.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              <button
                className="btn btn-error w-full"
                disabled={!removeUniversityAddress || loading === "removing" || VOTE_STATUS !== 0}
                onClick={() =>
                  handleTransaction(async () => {
                    if (!writeYourContractAsync) throw new Error("Contract not ready");
                    await writeYourContractAsync({
                      functionName: "removeUniversity",
                      args: [removeUniversityAddress],
                    });
                    setRemoveUniversityAddress("");
                  }, "Removing university")
                }
              >
                {loading === "removing" ? "Removing..." : "Remove University"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StartElectionCard = () => {
    if (VOTE_STATUS !== 0 || !isUniversity) return null;

    return (
      <div className="card bg-primary text-primary-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">🗳️ Start New Election</h2>
          <p>Start a new university election. Requires 100 wei fee (will be returned after election).</p>
          {universities.length === 0 && (
            <div className="alert alert-warning">
              <span>No universities registered. Current president must add universities first.</span>
            </div>
          )}
          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary"
              disabled={loading === "starting" || universities.length === 0}
              onClick={() =>
                handleTransaction(async () => {
                  if (!writeYourContractAsync) throw new Error("Contract not ready");
                  await writeYourContractAsync({
                    functionName: "startVotation",
                    value: parseEther("0.0000000000000001"), // 100 wei
                  });
                }, "Starting election")
              }
            >
              {loading === "starting" ? "Starting..." : "Start Election (100 wei)"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const VotingCard = () => {
    if (VOTE_STATUS !== 1 || !isUniversity) return null;

    if (hasVoted) {
      return (
        <div className="card bg-success text-success-content shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title">✅ Vote Submitted</h2>
            <p>You have successfully submitted your vote for this election.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="card bg-warning text-warning-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">🗳️ Submit Your Vote</h2>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-warning-content">Vote Data (JSON format)</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-24 text-base-content"
              placeholder='{"Alice": 50, "Bob": 30, "scheda bianca": 0}'
              value={voteData}
              onChange={e => setVoteData(e.target.value)}
            />
            <label className="label">
              <span className="label-text-alt text-warning-content">
                Example: {`{"Alice": 50, "Bob": 30, "scheda bianca": 0}`}
              </span>
            </label>
            {!validateVoteData(voteData) && voteData && (
              <label className="label">
                <span className="label-text-alt text-error">Invalid JSON format or values</span>
              </label>
            )}
          </div>

          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary"
              disabled={!validateVoteData(voteData) || loading === "voting"}
              onClick={() =>
                handleTransaction(async () => {
                  if (!writeYourContractAsync) throw new Error("Contract not ready");
                  await writeYourContractAsync({
                    functionName: "vote",
                    args: [voteData],
                  });
                  setVoteData("");
                }, "Submitting vote")
              }
            >
              {loading === "voting" ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CloseElectionCard = () => {
    if (VOTE_STATUS !== 2) return null;

    return (
      <div className="card bg-info text-info-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">🏁 Close Election</h2>
          <p>Election has ended. Anyone can close it and set the winner.</p>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-info-content">Winner Data (JSON format)</span>
            </label>
            <textarea
              className="textarea textarea-bordered h-24 text-base-content"
              placeholder='{"winner": "Alice", "votes": 150}'
              value={voteData}
              onChange={e => setVoteData(e.target.value)}
            />
          </div>

          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary"
              disabled={!voteData || loading === "closing"}
              onClick={() =>
                handleTransaction(async () => {
                  if (!writeYourContractAsync) throw new Error("Contract not ready");
                  await writeYourContractAsync({
                    functionName: "close",
                    args: [voteData],
                  });
                  setVoteData("");
                }, "Closing election")
              }
            >
              {loading === "closing" ? "Closing..." : "Close Election"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProfessorManagementCard = () => {
    if (VOTE_STATUS !== 0) return null;

    return (
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">👨‍🏫 Professor Management</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Enroll Professor */}
            <div className="space-y-3">
              <h3 className="font-semibold">Enroll Professor</h3>
              <select
                className="select select-bordered w-full"
                value={selectedUniversity}
                onChange={e => setSelectedUniversity(e.target.value)}
              >
                <option value="">Select University</option>
                {universities.map(uni => (
                  <option key={uni.address} value={uni.address}>
                    {uni.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary w-full"
                disabled={!selectedUniversity || loading === "enrolling" || universityAddress !== zeroAddress}
                onClick={() =>
                  handleTransaction(async () => {
                    if (!writeYourContractAsync) throw new Error("Contract not ready");
                    await writeYourContractAsync({
                      functionName: "enrollProfessor",
                      args: [selectedUniversity],
                      value: parseEther("0.00000000000000001"), // 10 wei
                    });
                    setSelectedUniversity("");
                  }, "Enrolling professor")
                }
              >
                {loading === "enrolling" ? "Enrolling..." : "Enroll (10 wei)"}
              </button>
              {universityAddress !== zeroAddress && (
                <p className="text-sm text-warning">You are already enrolled in a university</p>
              )}
            </div>

            {/* Remove Professor */}
            <div className="space-y-3">
              <h3 className="font-semibold">Remove Professor</h3>
              <p className="text-sm text-gray-600">Remove yourself from current university</p>
              <button
                className="btn btn-error w-full"
                disabled={universityAddress === zeroAddress || loading === "unenrolling"}
                onClick={() =>
                  handleTransaction(async () => {
                    if (!writeYourContractAsync) throw new Error("Contract not ready");
                    await writeYourContractAsync({
                      functionName: "removeProfessor",
                    });
                  }, "Removing professor")
                }
              >
                {loading === "unenrolling" ? "Removing..." : "Remove Professor"}
              </button>
              {universityAddress === zeroAddress && (
                <p className="text-sm text-info">You are not enrolled in any university</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const UniversityListCard = () => (
    <div className="card bg-base-100 shadow-xl mb-6">
      <div className="card-body">
        <h2 className="card-title">🏛️ Registered Universities</h2>

        {universities.length === 0 ? (
          <p className="text-gray-500">No universities registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {universities.map(uni => (
                  <tr key={uni.address}>
                    <td className="font-bold">{uni.name}</td>
                    <td className="font-mono text-sm">
                      {uni.address.slice(0, 8)}...{uni.address.slice(-6)}
                    </td>
                    <td>
                      {connectedAddress === uni.address && <span className="badge badge-primary">You</span>}
                      {hasVotedData && VOTE_STATUS === 1 && <span className="badge badge-success ml-2">Voted</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">University Election System</h1>
          <p className="text-lg text-base-content opacity-70">
            Decentralized voting system for universities with current president governance
          </p>
        </div>

        <NotificationBanner />
        <ElectionStatusCard />
        <PresidentManagementCard />
        <StartElectionCard />
        <VotingCard />
        <CloseElectionCard />
        <ProfessorManagementCard />
        <UniversityListCard />

        {!connectedAddress && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body text-center">
              <h2 className="card-title justify-center">🔌 Connect Your Wallet</h2>
              <p>Please connect your wallet to interact with the election system.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
