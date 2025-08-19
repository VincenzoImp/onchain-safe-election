"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { decrypt, encrypt, privateKey, publicKey, sum_encrypted } from "~~/crypto/fhe";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const zeroaddress = "0x0000000000000000000000000000000000000000";
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync: writeYourContractAsync } = useScaffoldWriteContract("YourContract");

  // State management
  const [selectedUniversity, setSelectedUniversity] = useState<string>("");
  const [voteData, setVoteData] = useState('{"Alice": 50, "Bob": 30, "scheda bianca": 0}');
  const [loading, setLoading] = useState<string>("");
  const [notification, setNotification] = useState<{ type: "success" | "error" | ""; message: string }>({
    type: "",
    message: "",
  });

  // Owner management state
  const [newUniversityAddress, setNewUniversityAddress] = useState<string>("");
  const [newUniversityName, setNewUniversityName] = useState<string>("");
  const [removeUniversityAddress, setRemoveUniversityAddress] = useState<string>("");

  // Contract reads
  const { data: owner } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "owner",
  });

  const { data: universityAddress, isLoading } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "professorToUniversity",
    args: [connectedAddress],
  });

  const { data: VOTE_STATUS, isLoading: isLoading2 } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "VOTE_STATUS",
  });

  const { data: hasVoted, isLoading: isLoading3 } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "hasVoted",
    args: [connectedAddress],
  });

  const { data: cap, isLoading: isLoading4 } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "CAP",
  });

  const { data: votesNumber } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "votesNumber",
  });

  const { data: univNumber } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "univNumber",
  });

  const { data: electionEndBlock } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "electionEndBlock",
  });

  const { data: winner } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "WINNER",
  });

  const { data: currentBlock } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getCurrentBlock",
  });

  const { data: universitiesData } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "getAllUniversitiesWithNames",
  });

  const { data: isUserUniversity } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "isUniversity",
    args: [connectedAddress],
  });

  // Auto-clear notifications
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        setNotification({ type: "", message: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Helper functions
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
  };

  const handleTransaction = async (txFunction: () => Promise<void>, operation: string) => {
    setLoading(operation);
    try {
      await txFunction();
      showNotification("success", `${operation} successful!`);
    } catch (e) {
      console.error(`Error ${operation}:`, e);
      showNotification("error", `Error ${operation}. Please try again.`);
    } finally {
      setLoading("");
    }
  };

  const validateVoteData = (voteString: string): boolean => {
    try {
      const voteJson = JSON.parse(voteString);
      if (typeof voteJson !== "object") return false;

      for (const [key, value] of Object.entries(voteJson)) {
        if (typeof key !== "string" || typeof value !== "number") return false;
        if (value < 0) return false;
      }

      const sum = Object.values(voteJson).reduce((acc: number, val) => acc + (val as number), 0);
      if (cap !== undefined && sum > cap) return false;

      return true;
    } catch {
      return false;
    }
  };

  // Loading state
  if (isLoading4 || isLoading3 || isLoading2 || isLoading || !connectedAddress || universityAddress === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="text-lg">Loading election data...</p>
        </div>
      </div>
    );
  }

  const isOwner = owner === connectedAddress;
  const isUniversity = isUserUniversity || false;
  const universities = universitiesData
    ? universitiesData[0].map((addr, index) => ({
        address: addr,
        name: universitiesData[1][index] || addr,
      }))
    : [];

  const statusNames = ["No Election", "In Progress", "Closed"];
  const statusColors = ["bg-gray-500", "bg-blue-500", "bg-green-500"];

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

        {VOTE_STATUS === 1 && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Votes: {votesNumber?.toString()}/{univNumber?.toString()}
              </span>
              <span>
                Blocks remaining:{" "}
                {electionEndBlock && currentBlock
                  ? (Number(electionEndBlock) - Number(currentBlock)).toString()
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

        {winner && (
          <div className="alert alert-success">
            <span className="font-bold">Winner: {winner}</span>
          </div>
        )}
      </div>
    </div>
  );

  const OwnerManagementCard = () => {
    if (!isOwner) return null;

    return (
      <div className="card bg-secondary text-secondary-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">👑 Owner Management</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add University */}
            <div className="space-y-3">
              <h3 className="font-semibold">Add University</h3>
              <input
                type="text"
                placeholder="University Address"
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
                    await writeYourContractAsync({
                      functionName: "addUniversity",
                      args: [newUniversityAddress, newUniversityName],
                    });
                    setNewUniversityAddress("");
                    setNewUniversityName("");
                  }, "adding")
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
                    await writeYourContractAsync({
                      functionName: "removeUniversity",
                      args: [removeUniversityAddress],
                    });
                    setRemoveUniversityAddress("");
                  }, "removing")
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
                disabled={!selectedUniversity || loading === "enrolling" || universityAddress !== zeroaddress}
                onClick={() =>
                  handleTransaction(async () => {
                    await writeYourContractAsync({
                      functionName: "enrollProfessor",
                      args: [selectedUniversity],
                      value: parseUnits("10", 1),
                    });
                    setSelectedUniversity("");
                  }, "enrolling")
                }
              >
                {loading === "enrolling" ? "Enrolling..." : "Enroll (10 wei)"}
              </button>
              {universityAddress !== zeroaddress && (
                <p className="text-sm text-warning">You are already enrolled in a university</p>
              )}
            </div>

            {/* Remove Professor */}
            <div className="space-y-3">
              <h3 className="font-semibold">Remove Professor</h3>
              <p className="text-sm text-gray-600">Remove yourself from current university</p>
              <button
                className="btn btn-error w-full"
                disabled={universityAddress === zeroaddress || loading === "unenrolling"}
                onClick={() =>
                  handleTransaction(async () => {
                    await writeYourContractAsync({
                      functionName: "removeProfessor",
                    });
                  }, "unenrolling")
                }
              >
                {loading === "unenrolling" ? "Removing..." : "Remove Professor"}
              </button>
              {universityAddress === zeroaddress && (
                <p className="text-sm text-info">You are not enrolled in any university</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const StartElectionCard = () => {
    if (VOTE_STATUS !== 0 || (!isUniversity && !isOwner)) return null;

    return (
      <div className="card bg-primary text-primary-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">🗳️ Start New Election</h2>
          <p>
            {isOwner
              ? "Start a new university election as owner (no fee required)."
              : "Start a new university election. Requires 100 wei fee."}
          </p>
          {universities.length === 0 && (
            <div className="alert alert-warning">
              <span>No universities registered. Add universities first.</span>
            </div>
          )}
          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary"
              disabled={loading === "starting" || universities.length === 0}
              onClick={() =>
                handleTransaction(async () => {
                  await writeYourContractAsync({
                    functionName: "startVotation",
                    value: isOwner ? parseUnits("0", 1) : parseUnits("100", 1),
                  });
                }, "starting")
              }
            >
              {loading === "starting" ? "Starting..." : isOwner ? "Start Election (Owner)" : "Start Election (100 wei)"}
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
                  const voteJson = JSON.parse(voteData);
                  const encryptedVote: { [key: string]: string } = {};

                  for (const [key, value] of Object.entries(voteJson)) {
                    encryptedVote[key] = (await encrypt(publicKey, BigInt(value as number))).toString();
                  }

                  await writeYourContractAsync({
                    functionName: "vote",
                    args: [JSON.stringify(encryptedVote)],
                  });
                }, "voting")
              }
            >
              {loading === "voting" ? "Submitting..." : "Submit Vote"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ResultsCard = () => {
    if (VOTE_STATUS !== 2) return null;

    const processResults = async () => {
      const results: { [key: string]: bigint[] } = {};

      // Process votes from all universities
      for (const university of universities) {
        try {
          // We need to fetch votes for each university individually
          // This is a workaround since we can't use hooks in async functions
          const response = await fetch(`/api/votes/${university.address}`);
          if (response.ok) {
            const votes = await response.text();
            if (votes) {
              const votesJson = JSON.parse(votes);
              for (const [key, value] of Object.entries(votesJson)) {
                const bigvalue = BigInt(value as string | number);
                if (key in results) {
                  results[key].push(bigvalue);
                } else {
                  results[key] = [bigvalue];
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Error processing votes for ${university.address}:`, error);
        }
      }

      // Sum and decrypt votes
      const votesSum: { [key: string]: bigint } = {};
      for (const [key, value] of Object.entries(results)) {
        votesSum[key] = sum_encrypted(publicKey, ...value.map(v => v as bigint));
      }

      const decryptedVotes: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(votesSum)) {
        decryptedVotes[key] = Number(await decrypt(privateKey, value as bigint));
      }

      const decryptedString = JSON.stringify(decryptedVotes);
      console.log("Election Results:", decryptedString);

      await writeYourContractAsync({
        functionName: "close",
        args: [decryptedString],
      });
    };

    return (
      <div className="card bg-info text-info-content shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">📊 Election Results</h2>
          <p>View and process election results.</p>

          <div className="card-actions justify-end">
            <button
              className="btn btn-secondary"
              disabled={loading === "processing"}
              onClick={() => handleTransaction(processResults, "processing")}
            >
              {loading === "processing" ? "Processing..." : "Process Results"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AccountInfoCard = () => {
    const getUserType = () => {
      if (isOwner) return { type: "Owner", color: "badge-accent" };
      if (isUniversity) return { type: "University", color: "badge-primary" };
      return { type: "User", color: "badge-neutral" };
    };

    const userType = getUserType();
    const enrolledUniversity = universities.find(u => u.address === universityAddress);

    return (
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">👤 Account Information</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Address:</span>
              <Address address={connectedAddress} />
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className={`badge ${userType.color}`}>{userType.type}</span>
            </div>
            {universityAddress !== zeroaddress && (
              <div className="flex justify-between">
                <span>Enrolled in:</span>
                <span className="text-sm font-medium">{enrolledUniversity?.name || universityAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const UniversityStatsCard = () => {
    const UniversityItem = ({ university }: { university: { address: string; name: string } }) => {
      const { data: uniInfo } = useScaffoldReadContract({
        contractName: "YourContract",
        functionName: "getUniversityInfo",
        args: [university.address],
      });

      return (
        <div className="p-3 bg-base-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium">{university.name}</h4>
              <p className="text-xs text-gray-600">{university.address.slice(0, 10)}...</p>
            </div>
            <div className="text-right text-sm">
              <div>
                Professors: {uniInfo ? uniInfo[2].toString() : "0"}/{cap?.toString()}
              </div>
              {VOTE_STATUS === 1 && (
                <div className="flex items-center space-x-1 text-xs mt-1">
                  {uniInfo && uniInfo[3] ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-600">Voted</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-orange-600">Pending</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">🏛️ Universities ({universities.length})</h2>
          {universities.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No universities registered</p>
          ) : (
            <div className="space-y-2">
              {universities.map(uni => (
                <UniversityItem key={uni.address} university={uni} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-base-200 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2">🗳️ University Election System</h1>
          <p className="text-xl text-base-content/70">Decentralized voting platform for universities</p>
          {isOwner && <div className="badge badge-accent badge-lg mt-2">Contract Owner</div>}
        </div>

        <NotificationBanner />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-6">
            <ElectionStatusCard />
            <OwnerManagementCard />
            <StartElectionCard />
            <VotingCard />
            <ResultsCard />
            <ProfessorManagementCard />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <AccountInfoCard />
            <UniversityStatsCard />

            {/* System Info Card */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">ℹ️ System Info</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Current Block:</span>
                    <span>{currentBlock?.toString() || "Loading..."}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Enrollment Fee:</span>
                    <span>10 wei</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Election Fee:</span>
                    <span>100 wei</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Professors:</span>
                    <span>{cap?.toString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
